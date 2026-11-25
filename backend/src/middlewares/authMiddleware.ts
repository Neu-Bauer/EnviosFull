import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prismaUnscoped } from '../lib/prisma.js';
import { getAuth } from '../lib/auth.js';
import { runWithTenant, getTenantContext } from '../lib/tenantContext.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export interface TokenPayload {
  id: number;
  username: string;
  sessaoToken: string;
  
  tenantId: number | null;
  isSuperAdmin: boolean;
}

export interface AuthRequest extends Request {
  usuario?: TokenPayload;
}

export const autenticarToken = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;

    
    const usuarioDb = await prismaUnscoped.usuario.findUnique({
      where: { id: decoded.id },
      select: {
        sessaoToken: true,
        tenantId: true,
        isSuperAdmin: true,
        tenant: { select: { status: true, modulos: true } },
      },
    });

    if (!usuarioDb || usuarioDb.sessaoToken !== decoded.sessaoToken) {
      return res.status(401).json({
        error: 'Sessão encerrada.',
        mensagem: 'Sua conta foi acessada em outro dispositivo. Faça login novamente.',
      });
    }

    if (!usuarioDb.isSuperAdmin && usuarioDb.tenant?.status !== 'ATIVO') {
      return res.status(403).json({
        code: 'TENANT_SUSPENSO',
        error: 'Acesso suspenso.',
        mensagem: 'O acesso da sua empresa está suspenso. Fale com o suporte.',
      });
    }

    const payload: TokenPayload = {
      id: decoded.id,
      username: decoded.username,
      sessaoToken: decoded.sessaoToken,
      tenantId: usuarioDb.tenantId,
      isSuperAdmin: usuarioDb.isSuperAdmin,
    };
    (req as AuthRequest).usuario = payload;

    
    return runWithTenant(
      {
        tenantId: payload.isSuperAdmin ? null : payload.tenantId,
        isSuperAdmin: payload.isSuperAdmin,
        usuarioId: payload.id,
        username: payload.username,
        modulos: usuarioDb.tenant?.modulos ?? [],
      },
      () => next()
    );
  } catch (error: unknown) {
    return res.status(401).json({ error: 'Token de segurança inválido ou expirado.' });
  }
};


export const somenteTenant = (req: Request, res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  if (!auth || auth.isSuperAdmin || auth.tenantId == null) {
    return res.status(403).json({
      error: 'Esta é uma rota de operação. Acesse com uma conta vinculada a uma empresa.',
    });
  }
  next();
};


export const exigirModulo = (chave: string) => (req: Request, res: Response, next: NextFunction) => {
  const modulos = getTenantContext()?.modulos ?? [];
  if (!modulos.includes(chave)) {
    return res.status(403).json({
      code: 'MODULO_NAO_CONTRATADO',
      error: `O módulo "${chave}" não está no plano da sua empresa.`,
    });
  }
  next();
};
