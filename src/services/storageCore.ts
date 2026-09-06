/**
 * Núcleo puro de persistência local: leitura/escrita em localStorage com cache
 * em memória, barramento de saúde e limites de tamanho (trim) para conversas e
 * materiais. Não importa Firebase nem depende de window — o backend de storage
 * é injetável para testar em Node. `src/services/storage.ts` delega aqui.
 */

export type StorageHealthEvent =
  | { kind: 'storage'; key: string; operation: 'read' | 'write'; error: string; at: string }
  | { kind: 'cloud-sync'; status: 'success' | 'error'; error?: string; at: string };

type HealthListener = (event: StorageHealthEvent) => void;

const healthListeners = new Set<HealthListener>();
let lastHealthEvent: StorageHealthEvent | null = null;

export function subscribeStorageHealth(listener: HealthListener): () => void {
  healthListeners.add(listener);
  return () => {
    healthListeners.delete(listener);
  };
}

export function getLastStorageHealthEvent(): StorageHealthEvent | null {
  return lastHealthEvent;
}

export function emitStorageHealth(event: StorageHealthEvent): void {
  lastHealthEvent = event;
  for (const listener of healthListeners) {
    try {
      listener(event);
    } catch {
      // Ouvinte com erro nunca pode derrubar o emissor.
    }
  }
}

interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

let storageBackend: StorageBackend | null = null;

function getBackend(): StorageBackend {
  if (!storageBackend) {
    storageBackend = (globalThis as { localStorage?: StorageBackend }).localStorage ?? null;
  }
  if (!storageBackend) {
    throw new Error('Nenhum backend de storage disponível (localStorage ausente).');
  }
  return storageBackend;
}

/** Injeta um backend (usado pelos testes; null volta ao localStorage global). */
export function setStorageBackend(backend: StorageBackend | null): void {
  storageBackend = backend;
  clearStorageCache();
}

export function clearStorageCache(): void {
  _storeCache.clear();
}

// Cache em memória por chave: evita re-parsear JSON profundo do localStorage a
// cada leitura (getNodes/getStats são chamados dezenas de vezes por render). A
// validade é verificada comparando a string crua; escritas atualizam o cache na
// mesma passada. Leituras devolvem cópia rasa para proteger o cache de
// mutações in-place dos chamadores.
const _storeCache = new Map<string, { raw: string; value: unknown }>();

export function readJsonCached<T>(storageKey: string): T | null {
  let raw: string | null;
  try {
    raw = getBackend().getItem(storageKey);
  } catch (err) {
    emitStorageHealth({
      kind: 'storage',
      key: storageKey,
      operation: 'read',
      error: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
    return null;
  }
  if (raw === null) return null;
  const hit = _storeCache.get(storageKey);
  let parsed: unknown;
  if (hit && hit.raw === raw) {
    parsed = hit.value;
  } else {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
    _storeCache.set(storageKey, { raw, value: parsed });
  }
  return (Array.isArray(parsed) ? [...parsed] : { ...(parsed as object) }) as T;
}

/**
 * Escreve JSON no localStorage sem propagar exceção (ex.: QuotaExceededError
 * em navegadores com cota cheia). Retorna false e emite evento de saúde quando
 * falha — o chamador degrada graciosamente em vez de quebrar o fluxo.
 */
export function writeJsonCached(storageKey: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  try {
    getBackend().setItem(storageKey, raw);
  } catch (err) {
    emitStorageHealth({
      kind: 'storage',
      key: storageKey,
      operation: 'write',
      error: err instanceof Error ? err.message : String(err),
      at: new Date().toISOString(),
    });
    return false;
  }
  _storeCache.set(storageKey, { raw, value });
  return true;
}

// Limites de tamanho do localStorage: impedem que um usuário pesado estoure a
// cota (QuotaExceededError) ao acumular conversas, mensagens e materiais.
export const STORAGE_LIMITS = {
  maxConversations: 30,
  maxMessagesPerConversation: 120,
  maxMaterials: 60,
} as const;

export interface TrimLikeConversation {
  mensagens: unknown[];
  atualizado_em?: string;
}

/** Mantém as N conversas mais recentes (por atualizado_em) e as últimas M mensagens de cada uma. */
export function trimConversations<T extends TrimLikeConversation>(
  list: T[],
  limits: Partial<{ maxConversations: number; maxMessagesPerConversation: number }> = {}
): T[] {
  const maxConversations = limits.maxConversations ?? STORAGE_LIMITS.maxConversations;
  const maxMessages = limits.maxMessagesPerConversation ?? STORAGE_LIMITS.maxMessagesPerConversation;
  return [...list]
    .sort((a, b) => (b.atualizado_em || '').localeCompare(a.atualizado_em || ''))
    .slice(0, maxConversations)
    .map((conv) => ({ ...conv, mensagens: conv.mensagens.slice(-maxMessages) }));
}
