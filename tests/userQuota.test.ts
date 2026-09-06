// tests/userQuota.test.ts
import { describe, expect, it, vi } from 'vitest';
import { createUserDailyQuota } from '../server/middleware/userQuota';

function makeCtx(uid?: string) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    req: { firebaseUser: uid ? { sub: uid } : undefined, ip: '1.1.1.1' } as any,
    res: { status } as any,
    next: vi.fn(),
    status,
    json,
  };
}

describe('createUserDailyQuota', () => {
  it('permite até o limite por uid e bloqueia com 429 depois', () => {
    let clock = new Date('2026-09-06T10:00:00Z');
    const quota = createUserDailyQuota(2, () => clock);
    const a = makeCtx('user-a');
    quota(a.req, a.res, a.next);
    quota(a.req, a.res, a.next);
    expect(a.next).toHaveBeenCalledTimes(2);
    quota(a.req, a.res, a.next);
    expect(a.status).toHaveBeenCalledWith(429);
    expect(a.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DAILY_QUOTA_EXCEEDED' }));
  });

  it('cotas são independentes por usuário', () => {
    const quota = createUserDailyQuota(1, () => new Date('2026-09-06T10:00:00Z'));
    const a = makeCtx('user-a');
    const b = makeCtx('user-b');
    quota(a.req, a.res, a.next);
    quota(a.req, a.res, a.next);
    expect(a.status).toHaveBeenCalledWith(429);
    quota(b.req, b.res, b.next);
    expect(b.next).toHaveBeenCalledTimes(1);
  });

  it('zera o contador no dia seguinte', () => {
    let clock = new Date('2026-09-06T23:59:00Z');
    const quota = createUserDailyQuota(1, () => clock);
    const a = makeCtx('user-a');
    quota(a.req, a.res, a.next);
    clock = new Date('2026-09-07T00:01:00Z');
    quota(a.req, a.res, a.next);
    expect(a.next).toHaveBeenCalledTimes(2);
  });

  it('sem uid autenticado cai no ip', () => {
    const quota = createUserDailyQuota(1, () => new Date('2026-09-06T10:00:00Z'));
    const anon = makeCtx(undefined);
    quota(anon.req, anon.res, anon.next);
    quota(anon.req, anon.res, anon.next);
    expect(anon.status).toHaveBeenCalledWith(429);
  });
});
