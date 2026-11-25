import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// O seed roda fora de request e precisa mexer no tenant → RLS desligado
// via GUC na conexão (ver src/lib/prisma.ts). Sem o bypass, o FORCE RLS
// (migração 0000_baseline) bloquearia os upserts.
function urlComBypass(): string {
  const base = process.env.DATABASE_URL
  if (!base) throw new Error('DATABASE_URL não definida')
  const [semQuery, query = ''] = base.split('?')
  const params = new URLSearchParams(query)
  params.delete('options')
  const partes = [...params].map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
  partes.push(`options=${encodeURIComponent('-c app.rls_bypass=on')}`)
  return `${semQuery}?${partes.join('&')}`
}

const prisma = new PrismaClient({ datasources: { db: { url: urlComBypass() } } })

const TENANT_NOME = process.env.SEED_TENANT_NOME || 'Pro4ce'
const TENANT_SLUG = process.env.SEED_TENANT_SLUG || 'pro4ce'

const PERMISSOES_ADMIN = ['full:view', 'full:manage']

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: TENANT_SLUG },
    update: {},
    create: { nome: TENANT_NOME, slug: TENANT_SLUG, modulos: ['full'] },
  })

  const cargoAdmin = await prisma.cargo.upsert({
    where: { tenantId_nome: { tenantId: tenant.id, nome: 'ADMIN' } },
    update: { permissoes: PERMISSOES_ADMIN },
    create: { tenantId: tenant.id, nome: 'ADMIN', permissoes: PERMISSOES_ADMIN },
  })

  const senhaAdmin = await bcrypt.hash(process.env.SEED_ADMIN_SENHA || 'admin123', 10)
  const admin = await prisma.usuario.upsert({
    where: { username: process.env.SEED_ADMIN_USERNAME || 'admin' },
    update: { tenantId: tenant.id },
    create: {
      username: process.env.SEED_ADMIN_USERNAME || 'admin',
      senha: senhaAdmin,
      precisaMudarSenha: true,
      isSuperAdmin: false,
      tenantId: tenant.id,
      cargoId: cargoAdmin.id,
    },
  })

  console.log(`\n✅ Seed concluído.`)
  console.log(`🏢 Tenant: ${tenant.nome} (id ${tenant.id}, slug "${tenant.slug}")`)
  console.log(`👤 ${admin.username} / ${process.env.SEED_ADMIN_SENHA || 'admin123'}  (admin — troque a senha no primeiro login)\n`)
}

main()
  .catch((e) => {
    console.error('❌ Erro ao rodar o seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
