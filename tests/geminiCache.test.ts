// tests/geminiCache.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiResponseCache } from '../server/ai/geminiCache';

describe('GeminiResponseCache', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('coalescenta chamadas idênticas em voo (produce roda 1x)', async () => {
    const cache = new GeminiResponseCache<number>(10, 60_000);
    let calls = 0;
    let resolve!: (v: number) => void;
    const first = cache.run('k', () => new Promise<number>((res) => { calls += 1; resolve = res; }));
    const second = cache.run('k', async () => { calls += 1; return 99; });
    resolve(42);
    await expect(first).resolves.toBe(42);
    await expect(second).resolves.toBe(42);
    expect(calls).toBe(1);
  });

  it('expira entrada após o TTL', async () => {
    const cache = new GeminiResponseCache<number>(10, 1_000);
    let calls = 0;
    await cache.run('k', async () => { calls += 1; return 1; });
    vi.advanceTimersByTime(1_001);
    await cache.run('k', async () => { calls += 1; return 2; });
    expect(calls).toBe(2);
  });

  it('evicta a entrada mais antiga ao passar de maxEntries', async () => {
    const cache = new GeminiResponseCache<number>(2, 60_000);
    let calls = 0;
    const produce = (v: number) => async () => { calls += 1; return v; };
    await cache.run('a', produce(1));
    await cache.run('b', produce(2));
    await cache.run('c', produce(3)); // evicta 'a'
    await cache.run('a', produce(11)); // cache miss → produce de novo
    // Ao reinserir 'a' num cache cheio {b, c}, a entrada mais antiga passa a ser
    // 'b' — então 'b' é evictado (comportamento LRU pinado pelo título do teste).
    expect(calls).toBe(4);
    await cache.run('c', produce(22)); // 'c' sobreviveu → hit → sem produce (refresca recência)
    expect(calls).toBe(4);
  });
});
