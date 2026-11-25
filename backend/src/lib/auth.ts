import { Request } from 'express';

export interface AuthInfo {
  id: number;
  username: string;
  sessaoToken: string;
  
  tenantId: number | null;
  isSuperAdmin: boolean;
}


export function getAuth(req: Request): AuthInfo | null {
  const u = (req as any).usuario;
  if (!u || typeof u.id !== 'number') return null;
  return {
    id: u.id,
    username: u.username,
    sessaoToken: u.sessaoToken,
    tenantId: u.tenantId ?? null,
    isSuperAdmin: !!u.isSuperAdmin,
  };
}


export function getTenantId(req: Request): number | null {
  return (req as any).usuario?.tenantId ?? null;
}


export function requireTenantId(req: Request): number {
  const tid = getAuth(req)?.tenantId ?? null;
  if (tid == null) {
    const err = new Error('Operação exige contexto de empresa.') as Error & { status?: number };
    err.status = 400;
    throw err;
  }
  return tid;
}
