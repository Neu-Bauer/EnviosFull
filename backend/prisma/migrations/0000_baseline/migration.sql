CREATE SCHEMA IF NOT EXISTS "public";

CREATE TABLE "Tenant" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "modulos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "mascarasSenhaHash" TEXT,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Cargo" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "permissoes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Cargo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "precisaMudarSenha" BOOLEAN NOT NULL DEFAULT true,
    "sessaoToken" TEXT,
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "cargoId" INTEGER,
    "tenantId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Motorista" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Motorista_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Veiculo" (
    "id" SERIAL NOT NULL,
    "modelo" TEXT NOT NULL,
    "placa" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "Veiculo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboundFull" (
    "id" SERIAL NOT NULL,
    "numeroFrete" TEXT,
    "nomePallet" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "usuarioId" INTEGER,
    "motoristaId" INTEGER,
    "veiculoId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "InboundFull_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InboundSku" (
    "id" SERIAL NOT NULL,
    "inboundId" INTEGER NOT NULL,
    "sku" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidadeTotal" INTEGER NOT NULL,
    "quantidadeBipada" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "variacoes" JSONB,
    "leituras" JSONB,
    "bloqueado" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "InboundSku_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MascaraSku" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "mascara" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" INTEGER NOT NULL,

    CONSTRAINT "MascaraSku_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

CREATE UNIQUE INDEX "Cargo_tenantId_nome_key" ON "Cargo"("tenantId", "nome");

CREATE UNIQUE INDEX "Usuario_username_key" ON "Usuario"("username");

CREATE UNIQUE INDEX "Veiculo_tenantId_placa_key" ON "Veiculo"("tenantId", "placa");

CREATE UNIQUE INDEX "MascaraSku_tenantId_sku_key" ON "MascaraSku"("tenantId", "sku");

ALTER TABLE "Cargo" ADD CONSTRAINT "Cargo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_cargoId_fkey" FOREIGN KEY ("cargoId") REFERENCES "Cargo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Motorista" ADD CONSTRAINT "Motorista_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Veiculo" ADD CONSTRAINT "Veiculo_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InboundFull" ADD CONSTRAINT "InboundFull_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundFull" ADD CONSTRAINT "InboundFull_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "Motorista"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundFull" ADD CONSTRAINT "InboundFull_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "Veiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InboundFull" ADD CONSTRAINT "InboundFull_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InboundSku" ADD CONSTRAINT "InboundSku_inboundId_fkey" FOREIGN KEY ("inboundId") REFERENCES "InboundFull"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InboundSku" ADD CONSTRAINT "InboundSku_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MascaraSku" ADD CONSTRAINT "MascaraSku_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'Cargo','Usuario','Motorista','Veiculo','InboundFull','InboundSku','MascaraSku'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
      USING (
        current_setting('app.rls_bypass', true) = 'on'
        OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), '')::int
      )
      WITH CHECK (
        current_setting('app.rls_bypass', true) = 'on'
        OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), '')::int
      )
    $p$, t);
  END LOOP;
END $$;
