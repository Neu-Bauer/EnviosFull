

import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, prismaUnscoped } from '../lib/prisma.js';
import { getAuth, requireTenantId } from '../lib/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const TIPO_TOKEN_MASCARA = 'mascara_unlock';

export const exigirSenhaMascara = (req: Request, res: Response, next: NextFunction) => {
  const token = req.headers['x-mascara-token'] as string | undefined;
  if (!token) {
    return res.status(403).json({ error: 'Informe a senha de máscaras para continuar.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { tipo?: string; tenantId?: number };
    const auth = getAuth(req);
    if (decoded.tipo !== TIPO_TOKEN_MASCARA || decoded.tenantId !== auth?.tenantId) {
      return res.status(403).json({ error: 'Sessão de máscaras inválida.' });
    }
    next();
  } catch {
    return res.status(403).json({ error: 'Sessão de máscaras expirada. Informe a senha novamente.' });
  }
};

export const verificarSenha = async (req: Request, res: Response) => {
  try {
    const { senha } = req.body;
    const tid = requireTenantId(req);
    if (!senha) return res.status(400).json({ error: 'Informe a senha.' });

    const tenant = await prismaUnscoped.tenant.findUnique({ where: { id: tid }, select: { mascarasSenhaHash: true } });

    if (!tenant?.mascarasSenhaHash) {
      return res.status(409).json({ code: 'SENHA_NAO_DEFINIDA', error: 'Nenhuma senha de máscaras foi definida ainda.' });
    }

    const confere = await bcrypt.compare(senha, tenant.mascarasSenhaHash);
    if (!confere) return res.status(403).json({ error: 'Senha incorreta.' });

    const token = jwt.sign({ tipo: TIPO_TOKEN_MASCARA, tenantId: tid }, JWT_SECRET, { expiresIn: '4h' });
    return res.json({ token });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro ao verificar a senha.' });
  }
};

export const definirSenha = async (req: Request, res: Response) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    const tid = requireTenantId(req);
    if (!novaSenha || String(novaSenha).length < 4) {
      return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 4 caracteres.' });
    }

    const tenant = await prismaUnscoped.tenant.findUnique({ where: { id: tid }, select: { mascarasSenhaHash: true } });

    if (tenant?.mascarasSenhaHash) {
      if (!senhaAtual) return res.status(400).json({ error: 'Informe a senha atual.' });
      const confere = await bcrypt.compare(senhaAtual, tenant.mascarasSenhaHash);
      if (!confere) return res.status(403).json({ error: 'Senha atual incorreta.' });
    }

    const novoHash = await bcrypt.hash(String(novaSenha), 10);
    await prismaUnscoped.tenant.update({ where: { id: tid }, data: { mascarasSenhaHash: novoHash } });

    return res.json({ mensagem: tenant?.mascarasSenhaHash ? 'Senha de máscaras atualizada!' : 'Senha de máscaras definida!' });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro ao definir a senha.' });
  }
};

export const listarMascaras = async (_req: Request, res: Response) => {
  try {
    const mascaras = await prisma.mascaraSku.findMany({ orderBy: { sku: 'asc' } });
    return res.json({ mascaras });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao listar as máscaras.' });
  }
};

export const sincronizarMascaras = async (req: Request, res: Response) => {
  try {
    const { mascaras } = req.body;
    const tid = requireTenantId(req);

    if (!mascaras || typeof mascaras !== 'object' || Array.isArray(mascaras)) {
      return res.status(400).json({ error: 'Formato inválido. Envie um objeto { "SKU": "MÁSCARA" }.' });
    }

    const entradas = Object.entries(mascaras as Record<string, unknown>).map(([sku, mascara]) => ({
      sku: String(sku).trim(),
      mascara: typeof mascara === 'string' ? mascara.trim() : '',
    }));

    for (const { sku, mascara } of entradas) {
      if (!sku || !mascara) {
        return res.status(400).json({ error: `Entrada inválida para o SKU "${sku || '(vazio)'}" — SKU e máscara não podem ficar em branco.` });
      }
    }

    await prisma.$transaction([
      prisma.mascaraSku.deleteMany({}),
      ...entradas.map(({ sku, mascara }) => prisma.mascaraSku.create({ data: { sku, mascara, tenantId: tid } })),
    ]);

    const atualizado = await prisma.mascaraSku.findMany({ orderBy: { sku: 'asc' } });
    return res.json({ mensagem: 'Máscaras salvas com sucesso!', mascaras: atualizado });
  } catch (error: any) {
    return res.status(error.status || 500).json({ error: error.message || 'Erro ao salvar as máscaras.' });
  }
};
