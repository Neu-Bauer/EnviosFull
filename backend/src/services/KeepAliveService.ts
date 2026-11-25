

import { prismaUnscoped as prisma } from '../lib/prisma.js';

export class KeepAliveService {
  private static intervalId: ReturnType<typeof setInterval> | null = null;

  public static start() {
    console.log('⏰ KeepAliveService: Vigilância iniciada. O Banco de Dados não irá hibernar.');

    
    
    const INTERVALO = 4 * 60 * 1000;

    this.intervalId = setInterval(async () => {
      try {
        
        
        await prisma.$queryRaw`SELECT 1`;
        
        
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] ❌ KeepAlive: Erro ao pingar o banco de dados:`, error);
      }
    }, INTERVALO);
  }

  public static stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      console.log('🛑 KeepAliveService: Vigilância encerrada.');
    }
  }
}