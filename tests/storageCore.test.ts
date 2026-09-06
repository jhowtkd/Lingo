import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStorageCache,
  readJsonCached,
  setStorageBackend,
  subscribeStorageHealth,
  writeJsonCached,
} from '../src/services/storageCore';

function makeFakeStorage(overrides: Partial<Storage> = {}) {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k: string, v: string) => map.set(k, v),
    removeItem: (k: string) => map.delete(k),
    ...overrides,
  };
}

describe('storageCore', () => {
  beforeEach(() => {
    clearStorageCache();
    setStorageBackend(makeFakeStorage());
  });

  it('faz round-trip de valores JSON', () => {
    writeJsonCached('k1', { a: 1, list: [1, 2] });
    expect(readJsonCached<{ a: number }>('k1')).toEqual({ a: 1, list: [1, 2] });
  });

  it('retorna null para JSON corrompido sem lançar', () => {
    const storage = makeFakeStorage();
    storage.setItem('k2', '{quebrado');
    setStorageBackend(storage);
    expect(readJsonCached('k2')).toBeNull();
  });

  it('não lança em QuotaExceededError e emite evento de saúde', () => {
    const storage = makeFakeStorage({
      setItem: () => {
        const err = new Error('exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      },
    } as Partial<Storage>);
    setStorageBackend(storage);
    const events: unknown[] = [];
    subscribeStorageHealth((e) => events.push(e));
    expect(writeJsonCached('k3', { a: 1 })).toBe(false);
    expect(events).toHaveLength(1);
    expect((events[0] as { kind: string; error: string }).kind).toBe('storage');
    expect((events[0] as { error: string }).error).toContain('exceeded');
  });

  it('não lança se o backend falhar na leitura', () => {
    setStorageBackend({
      getItem: () => {
        throw new Error('acesso negado');
      },
      setItem: () => {},
      removeItem: () => {},
    });
    expect(readJsonCached('k4')).toBeNull();
  });
});
