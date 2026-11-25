import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { getTenantContext } from './tenantContext.js';



const MODELOS_SEM_TENANT = new Set(['Tenant']);

const OPERACOES_COM_WHERE = new Set([
  'findUnique', 'findUniqueOrThrow',
  'findFirst', 'findFirstOrThrow',
  'findMany',
  'update', 'updateMany', 'updateManyAndReturn',
  'delete', 'deleteMany',
  'count', 'aggregate', 'groupBy',
]);

const OPERACOES_COM_DATA = new Set(['create', 'createMany', 'createManyAndReturn']);


function injetarTenantEmData(data: any, tenantId: number): void {
  if (Array.isArray(data)) {
    data.forEach((d) => injetarTenantEmData(d, tenantId));
    return;
  }
  if (!data || typeof data !== 'object') return;

  if (!('tenantId' in data)) data.tenantId = tenantId;

  for (const key of Object.keys(data)) {
    const val = data[key];
    if (!val || typeof val !== 'object') continue;
    if ('create' in val) injetarTenantEmData(val.create, tenantId);
    if ('createMany' in val && val.createMany?.data) injetarTenantEmData(val.createMany.data, tenantId);
    if ('connectOrCreate' in val) {
      const lista = Array.isArray(val.connectOrCreate) ? val.connectOrCreate : [val.connectOrCreate];
      lista.forEach((c: any) => c?.create && injetarTenantEmData(c.create, tenantId));
    }
  }
}


function montarUrl(gucs: Record<string, string>, connectionLimit = 5): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error('DATABASE_URL não definida');

  const [semQuery, queryExistente = ''] = base.split('?');
  const params = new URLSearchParams(queryExistente);
  params.delete('options');
  params.set('connection_limit', String(connectionLimit));

  const opts = Object.entries(gucs).map(([k, v]) => `-c ${k}=${v}`).join(' ');
  const partes = [...params].map(([k, v]) => `${k}=${encodeURIComponent(v)}`);
  partes.push(`options=${encodeURIComponent(opts)}`);
  return `${semQuery}?${partes.join('&')}`;
}




export const prismaUnscoped = new PrismaClient({
  datasources: { db: { url: montarUrl({ 'app.rls_bypass': 'on' }, 10) } },
});

async function escopo({ model, operation, args, query }: any) {
  const ctx = getTenantContext();

  
  if (!ctx || (model && MODELOS_SEM_TENANT.has(model))) return query(args);

  
  if (ctx.isSuperAdmin || ctx.tenantId == null) {
    throw new Error(`[tenant] "${model}.${operation}" sem empresa no contexto — use prismaUnscoped.`);
  }

  const tenantId = ctx.tenantId;
  const a: any = args ?? {};

  if (OPERACOES_COM_WHERE.has(operation)) {
    a.where = { ...(a.where ?? {}), tenantId };
  } else if (OPERACOES_COM_DATA.has(operation)) {
    injetarTenantEmData(a.data, tenantId);
  } else if (operation === 'upsert') {
    injetarTenantEmData(a.create, tenantId);
    if (!JSON.stringify(a.where ?? {}).includes('tenantId')) {
      console.warn(`[prisma] upsert em "${model}" sem tenantId no where — passe a chave composta.`);
    }
  }

  return query(a);
}

function criarClienteTenant(tenantId: number) {
  return new PrismaClient({
    datasources: { db: { url: montarUrl({ 'app.current_tenant': String(tenantId) }) } },
  }).$extends({ query: { $allModels: { $allOperations: escopo } } });
}

type ClienteTenant = ReturnType<typeof criarClienteTenant>;

const cacheTenant = new Map<number, ClienteTenant>();

function clienteDoTenant(tenantId: number): ClienteTenant {
  let c = cacheTenant.get(tenantId);
  if (!c) {
    c = criarClienteTenant(tenantId);
    cacheTenant.set(tenantId, c);
  }
  return c;
}


export const prisma: ClienteTenant = new Proxy({} as ClienteTenant, {
  get(_target, prop) {
    const ctx = getTenantContext();
    if (!ctx) {
      throw new Error('[tenant] `prisma` usado fora de um request autenticado — use prismaUnscoped.');
    }
    if (ctx.isSuperAdmin || ctx.tenantId == null) {
      throw new Error('[tenant] conta de plataforma acessou `prisma` — rotas de /superadmin usam prismaUnscoped.');
    }
    const client = clienteDoTenant(ctx.tenantId) as any;
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});


export async function disconnectAll(): Promise<void> {
  await Promise.allSettled([
    prismaUnscoped.$disconnect(),
    ...[...cacheTenant.values()].map((c) => c.$disconnect()),
  ]);
}

export type ScopedPrisma = typeof prisma;
