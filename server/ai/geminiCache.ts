/**
 * Cache LRU com coalescimento de requisições idênticas em voo, para chamadas
 * caras ao Gemini (word-context, pronúncia). Requisições repetidas do mesmo
 * conteúdo — muito comuns em app de idioma — deixam de gerar nova cobrança e
 * nova latência de rede.
 */
export class GeminiResponseCache<T> {
  private cache = new Map<string, { value: T; expiresAt: number }>();
  private inflight = new Map<string, Promise<T>>();

  constructor(
    private maxEntries: number,
    private ttlMs: number
  ) {}

  async run(key: string, produce: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit) {
      if (hit.expiresAt > Date.now()) {
        // Refresca a recência (Map itera na ordem de inserção => LRU barato)
        this.cache.delete(key);
        this.cache.set(key, hit);
        return hit.value;
      }
      this.cache.delete(key);
    }

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = produce()
      .then((value) => {
        this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
        if (this.cache.size > this.maxEntries) {
          const oldest = this.cache.keys().next().value;
          if (oldest !== undefined) this.cache.delete(oldest);
        }
        return value;
      })
      .finally(() => {
        this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }
}
