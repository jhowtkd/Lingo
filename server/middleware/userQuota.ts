// server/middleware/userQuota.ts
import type { NextFunction, Request, Response } from 'express';

interface DailyBucket {
  date: string;
  counts: Map<string, number>;
}

/**
 * Cota diária por usuário (uid Firebase) para rotas caras de IA. In-memory:
 * reiniciar o processo zera contadores (aceitável para proteção de custo;
 * réplicas múltiplas exigiriam store compartilhado).
 */
export function createUserDailyQuota(limitPerDay: number, now: () => Date = () => new Date()) {
  const bucket: DailyBucket = { date: now().toISOString().slice(0, 10), counts: new Map() };

  return function userDailyQuota(req: Request, res: Response, next: NextFunction) {
    const today = now().toISOString().slice(0, 10);
    if (bucket.date !== today) {
      bucket.date = today;
      bucket.counts.clear();
    }
    const uid = req.firebaseUser?.sub || req.ip || 'anon';
    const used = bucket.counts.get(uid) || 0;
    if (used >= limitPerDay) {
      return res.status(429).json({
        error: `Limite diário de ${limitPerDay} uso(s) deste recurso atingido. Tente novamente amanhã.`,
        code: 'DAILY_QUOTA_EXCEEDED',
      });
    }
    bucket.counts.set(uid, used + 1);
    next();
  };
}
