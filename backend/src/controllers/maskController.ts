
import { prisma } from '../lib/prisma.js';

export const carregarMascaras = async (): Promise<Record<string, string>> => {
  const registros = await prisma.mascaraSku.findMany();
  return Object.fromEntries(registros.map((r) => [r.sku, r.mascara]));
};
