import { AsyncLocalStorage } from 'node:async_hooks';



export interface TenantContext {
  tenantId: number | null;
  isSuperAdmin: boolean;
  usuarioId?: number | null;
  username?: string | null;
  
  modulos?: string[];
}

const storage = new AsyncLocalStorage<TenantContext>();


export function runWithTenant<T>(ctx: TenantContext, fn: () => T): T {
  return storage.run(ctx, fn);
}


export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}


export function currentTenantId(): number | null {
  return storage.getStore()?.tenantId ?? null;
}

export function isSuperAdminContext(): boolean {
  return storage.getStore()?.isSuperAdmin ?? false;
}
