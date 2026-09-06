# Lingo — Fundação e Confiabilidade (10 Melhorias ICE) — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 10 melhorias priorizadas pelo ICE na auditoria de 2026-09-06: resiliência do armazenamento local, CI, endurecimento de deploy/config, sync Firestore correto, testes dos núcleos, erros visíveis, controle de custo por usuário, SM-2 real, acessibilidade e desmonolitização do `server.ts`.

**Architecture:** O app é um SPA React 19 + Vite servido por um Express monolítico (`server.ts`, 2.142 linhas) com Firebase Auth/Firestore e Gemini. O plano extrai um núcleo puro de persistência testável (`storageCore.ts`), corrige a sincronização com carimbos de tempo e chunking, unifica as duas pilhas de retry Gemini num helper único e adiciona cotas diárias por usuário — sem trocar a stack nem o design system.

**Tech Stack:** TypeScript 5.8, React 19, Vite 6, Express 4, Firebase 12, Vitest 4 (ambiente `node`, sem jsdom), `@google/genai`.

**Spec:** Análise ICE da conversa de 2026-09-06 (tabela "10 Melhorias"), baseada em auditoria de código com referências `file:line`. Precedente de restrições: `docs/superpowers/specs/2026-08-30-lingo-product-hardening.md`.

## Global Constraints

- Sem novas dependências de runtime. `npm run lint` = `tsc --noEmit`; manter `npm test` e `npm run build` verdes ao fim de cada task.
- Vitest roda em ambiente `node` (`vitest.config.ts`: `environment: 'node'`, `globals: true`, include `tests/**/*.test.{ts,tsx}`). **Nada de jsdom**: mocks de `localStorage` são objetos inline; nenhum teste pode importar `src/services/storage.ts` ou `src/services/firebase.ts` (executam `initializeApp` no topo do módulo). A lógica nova de storage vive em módulos puros testáveis.
- UI e comentários de código em PT-BR, seguindo o padrão do repositório.
- Não redesenhar identidade visual; não trocar Tailwind, Motion, Firebase, Vitest, Vite ou Express.
- Compatibilidade retroativa: nenhuma mudança pode corromper chaves existentes do localStorage; campos novos em tipos são opcionais.
- Cada task termina com um commit isolado e qualidade verde.

---

# Onda 1 — Fundação (Melhorias ICE #1, #2, #3)

### Task 1: `storageCore.ts` — E/S resiliente + barramento de saúde

**Files:**
- Create: `src/services/storageCore.ts`
- Create: `tests/storageCore.test.ts`
- Modify: `src/services/storage.ts:831-869` (remover `_storeCache`/`readJsonCached`/`writeJsonCached` locais; delegar ao novo módulo)

**Interfaces:**
- Produces: `writeJsonCached(key, value): boolean`, `readJsonCached<T>(key): T | null`, `subscribeStorageHealth(cb): () => void`, `getLastStorageHealthEvent()`, `emitStorageHealth(event)`, `clearStorageCache()`, `setStorageBackend(backend | null)`, tipo `StorageHealthEvent`. Tasks 2, 5, 6, 7 e 8 consomem estes nomes exatos.

- [ ] **Step 1: Write the failing test**

```ts
// tests/storageCore.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storageCore.test.ts`
Expected: FAIL — `Cannot find module '../src/services/storageCore'`

- [ ] **Step 3: Write the implementation**

```ts
// src/services/storageCore.ts
/**
 * Núcleo puro de persistência local: leitura/escrita em localStorage com cache
 * em memória, barramento de saúde e (na Task 2) limites de tamanho. Não importa
 * Firebase nem depende de window — o backend de storage é injetável para
 * testar em Node. `src/services/storage.ts` delega aqui.
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
```

- [ ] **Step 4: Delegate from storage.ts**

Em `src/services/storage.ts`:
1. Adicionar no topo: `import { clearStorageCache, readJsonCached, writeJsonCached } from './storageCore';`
2. **Remover** o bloco local (linhas ~831-860): o comentário do cache, `const _storeCache = ...`, `readJsonCached`, `writeJsonCached` (todo o código movido para `storageCore.ts`).
3. Em `setCurrentUser` (~linha 865-869): trocar `_storeCache.clear();` por `clearStorageCache();`.
4. Conferir que nenhum outro ponto do arquivo referenciava `_storeCache` diretamente (grep `_storeCache` deve restar zero ocorrências em `storage.ts`).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/storageCore.test.ts && npm test && npm run lint`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/storageCore.ts src/services/storage.ts tests/storageCore.test.ts
git commit -m "feat(storage): extrai núcleo puro de persistência com escrita resiliente e barramento de saúde"
```

---

### Task 2: Limites de tamanho (trim de conversas e materiais)

**Files:**
- Modify: `src/services/storageCore.ts` (adicionar `STORAGE_LIMITS` + `trimConversations`)
- Modify: `src/services/storage.ts` (aplicar trim em `saveConversations` ~linha 1470 e `saveMaterials`)
- Modify: `tests/storageCore.test.ts` (novos casos)

**Interfaces:**
- Produces: `STORAGE_LIMITS` (`{ maxConversations: 30, maxMessagesPerConversation: 120, maxMaterials: 60 }`), `trimConversations<T>(list, limits?): T[]`.

- [ ] **Step 1: Write the failing test** (acrescentar ao `tests/storageCore.test.ts`)

```ts
import { STORAGE_LIMITS, trimConversations } from '../src/services/storageCore';

describe('trimConversations', () => {
  const conv = (id: string, atualizado_em: string, nMsgs: number) => ({
    id,
    atualizado_em,
    mensagens: Array.from({ length: nMsgs }, (_, i) => ({ i })),
  });

  it('mantém as N conversas mais recentes por atualizado_em', () => {
    const list = [conv('a', '2026-01-01', 1), conv('b', '2026-03-01', 1), conv('c', '2026-02-01', 1)];
    const result = trimConversations(list, { maxConversations: 2 });
    expect(result.map((c) => c.id)).toEqual(['b', 'c']);
  });

  it('corta as mensagens antigas, mantendo as últimas M', () => {
    const result = trimConversations([conv('x', '2026-01-01', 200)], { maxMessagesPerConversation: 120 });
    expect(result[0].mensagens).toHaveLength(120);
    expect(result[0].mensagens[0]).toEqual({ i: 80 });
    expect(result[0].mensagens[119]).toEqual({ i: 199 });
  });

  it('não muta a lista de entrada', () => {
    const list = [conv('a', '2026-01-01', 150)];
    trimConversations(list);
    expect(list[0].mensagens).toHaveLength(150);
  });

  it('usa os limites padrão quando nada é passado', () => {
    expect(STORAGE_LIMITS.maxConversations).toBe(30);
    expect(STORAGE_LIMITS.maxMessagesPerConversation).toBe(120);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storageCore.test.ts`
Expected: FAIL — `trimConversations is not exported`

- [ ] **Step 3: Implement** (acrescentar ao `src/services/storageCore.ts`)

```ts
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
```

- [ ] **Step 4: Aplicar em storage.ts**

Em `saveConversations` (localizar com grep `saveConversations(list)`): trocar o corpo para `writeJsonCached(this.getKey(STORAGE_KEYS.CONVERSATIONS), trimConversations(list));` (importar `trimConversations` junto do bloco de imports da Task 1). Em `saveMaterials`: aplicar `list.slice(0, STORAGE_LIMITS.maxMaterials)` antes de escrever.

- [ ] **Step 5: Run tests and quality gates**

Run: `npx vitest run tests/storageCore.test.ts && npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/services/storageCore.ts src/services/storage.ts tests/storageCore.test.ts
git commit -m "feat(storage): limita tamanho de conversas e materiais no localStorage"
```

---

### Task 3: CI (GitHub Actions) + package-lock + script quebrado

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `.gitignore` (remover a linha `package-lock.json`)
- Modify: `package.json` (remover a linha `"test:eval": "tsx evals/runTutorEvals.ts"`)
- Modify: `tsconfig.json:28` (remover `"evals"` do `include`)
- Create: `package-lock.json` (regenerado via `npm install`)

- [ ] **Step 1: Limpar o repo**

1. Em `.gitignore`, apagar a linha `package-lock.json`.
2. Em `package.json`, apagar a linha `"test:eval": "tsx evals/runTutorEvals.ts",` (a pasta `evals/` não existe — script quebrado).
3. Em `tsconfig.json`, trocar `"include": ["src", "server", "tests", "evals", "*.ts"]` por `"include": ["src", "server", "tests", "*.ts"]`.

- [ ] **Step 2: Regenerar o lockfile**

Run: `npm install`
Expected: gera `package-lock.json`; `git status` passa a mostrá-lo como arquivo novo (não ignorado).

- [ ] **Step 3: Criar o workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build
```

- [ ] **Step 4: Verificar localmente os mesmos comandos do CI**

Run: `npm run lint && npm test && npm run build`
Expected: PASS nos três.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .gitignore package.json package-lock.json tsconfig.json
git commit -m "ci: adiciona pipeline de qualidade e restaura lockfile do npm"
```

---

### Task 4: Config de ambiente validada + PORT dinâmico + segredos

**Files:**
- Create: `server/config/env.ts`
- Create: `tests/envConfig.test.ts`
- Modify: `server.ts:19` (PORT), `server.ts:17-39` (avisos de startup), `server.ts:166-172` (health sem `hasApiKey`)
- Modify: `server/auth/verifyFirebaseToken.ts:14-19` (remover default com e-mails reais)
- Modify: `.env.example` (documentar todas as variáveis lidas pelo código)

**Interfaces:**
- Produces: `loadEnvConfig(env?): AppEnvConfig` com `{ port: number; geminiApiKey: string | null; firebaseProjectId: string; adminEmails: string[]; geminiTimeoutMs: number; warnings: string[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/envConfig.test.ts
import { describe, expect, it } from 'vitest';
import { loadEnvConfig } from '../server/config/env';

describe('loadEnvConfig', () => {
  it('aplica padrões seguros quando o ambiente está vazio', () => {
    const cfg = loadEnvConfig({});
    expect(cfg.port).toBe(3000);
    expect(cfg.geminiApiKey).toBeNull();
    expect(cfg.firebaseProjectId).toBe('gn-coach');
    expect(cfg.adminEmails).toEqual([]);
    expect(cfg.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it('normaliza PORT, chave e e-mails admin', () => {
    const cfg = loadEnvConfig({
      PORT: '8080',
      GEMINI_API_KEY: '  abc  ',
      FIREBASE_PROJECT_ID: 'lingo-prod',
      ADMIN_EMAILS: ' A@B.com , c@d.org ',
      GEMINI_TIMEOUT_MS: '15000',
    });
    expect(cfg.port).toBe(8080);
    expect(cfg.geminiApiKey).toBe('abc');
    expect(cfg.firebaseProjectId).toBe('lingo-prod');
    expect(cfg.adminEmails).toEqual(['a@b.com', 'c@d.org']);
    expect(cfg.geminiTimeoutMs).toBe(15000);
  });

  it('PORT inválida cai no padrão 3000', () => {
    expect(loadEnvConfig({ PORT: 'abc' }).port).toBe(3000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/envConfig.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `server/config/env.ts`**

```ts
/**
 * Fonte única de configuração de ambiente com validação no startup. Sem chave
 * Gemini o servidor sobe em modo degradado (fallback local), então ausência é
 * AVISO, não erro — mas o aviso precisa ser explícito no log.
 */
export interface AppEnvConfig {
  port: number;
  geminiApiKey: string | null;
  firebaseProjectId: string;
  adminEmails: string[];
  geminiTimeoutMs: number;
  warnings: string[];
}

export function loadEnvConfig(env: Record<string, string | undefined> = process.env): AppEnvConfig {
  const warnings: string[] = [];

  const rawPort = Number.parseInt(env.PORT || '3000', 10);
  const port = Number.isFinite(rawPort) && rawPort > 0 ? rawPort : 3000;

  const geminiApiKey = env.GEMINI_API_KEY?.trim() || null;
  if (!geminiApiKey) {
    warnings.push('GEMINI_API_KEY ausente: servidor em modo degradado (fallback local de tutor e TTS do navegador).');
  }

  const firebaseProjectId = env.FIREBASE_PROJECT_ID?.trim() || 'gn-coach';
  if (!env.FIREBASE_PROJECT_ID?.trim()) {
    warnings.push('FIREBASE_PROJECT_ID ausente: usando "gn-coach" para validar ID tokens.');
  }

  const adminEmails = (env.ADMIN_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (adminEmails.length === 0) {
    warnings.push('ADMIN_EMAILS ausente: nenhuma conta terá acesso admin no servidor.');
  }

  const rawTimeout = Number.parseInt(env.GEMINI_TIMEOUT_MS || '60000', 10);
  return {
    port,
    geminiApiKey,
    firebaseProjectId,
    adminEmails,
    geminiTimeoutMs: Number.isFinite(rawTimeout) && rawTimeout > 0 ? rawTimeout : 60000,
    warnings,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/envConfig.test.ts`
Expected: PASS.

- [ ] **Step 5: Ligar no server.ts e remove segredos**

1. `server.ts`: importar `loadEnvConfig`; trocar `const PORT = 3000;` por `const appEnv = loadEnvConfig(); const PORT = appEnv.port;` e, logo após `dotenv.config();`, adicionar:
   ```ts
   for (const warning of appEnv.warnings) {
     console.warn(`[Config] ${warning}`);
   }
   ```
2. `server.ts` health check (~166-172): remover o campo `hasApiKey` da resposta (deixar `{ status: 'ok', timestamp }`).
3. `server/auth/verifyFirebaseToken.ts` (~14-19): trocar o default por string vazia (sem e-mails placeholder):
   ```ts
   const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
     .split(',')
     .map((e) => e.trim().toLowerCase())
     .filter(Boolean);
   ```
4. Reescrever `.env.example`:
   ```
   # Chave da API do Gemini. Sem ela o servidor sobe em modo degradado
   # (fallback local de tutor + TTS do navegador).
   GEMINI_API_KEY=""

   # URL pública do app (links self-referenciais).
   APP_URL="http://localhost:3000"

   # Project ID do Firebase usado para validar ID tokens (deve bater com o
   # projeto configurado em src/services/firebase.ts).
   FIREBASE_PROJECT_ID=""

   # E-mails (separados por vírgula) com acesso admin (/api/telemetry).
   # Vazio = nenhum admin no servidor.
   ADMIN_EMAILS=""

   # Timeout por tentativa de chamada ao Gemini, em ms (padrão 60000).
   GEMINI_TIMEOUT_MS="60000"
   ```

- [ ] **Step 6: Quality gates e commit**

Run: `npm run lint && npm test && npm run build`
Expected: PASS.

```bash
git add server/config/env.ts tests/envConfig.test.ts server.ts server/auth/verifyFirebaseToken.ts .env.example
git commit -m "feat(server): valida env no startup, porta dinâmica e remove segredos do código"
```

---

# Onda 2 — Confiabilidade (Melhorias ICE #4, #5, #6, #8)

### Task 5: Decisão de sync + meta de carimbos (TDD)

**Files:**
- Modify: `src/services/storageCore.ts` (adicionar `SyncCollection`, `shouldApplyCloudCollection`, `readSyncMeta`, `writeSyncMeta`)
- Modify: `src/services/storage.ts` (wrappers de meta com namespacing por usuário + `touchLocalSyncStamp` nos saves)
- Modify: `tests/storageCore.test.ts`

**Interfaces:**
- Produces: tipo `SyncCollection = 'stats' | 'nodes' | 'relations' | 'materials' | 'corrections' | 'conversations'`; `shouldApplyCloudCollection({ localIsEmpty, localStamp, cloudUpdatedAt }): boolean`; `readSyncMeta(key): { stamps, cloudChunks }` / `writeSyncMeta(key, meta)`; em `StorageService`: `getLocalSyncStamp(col)`, `touchLocalSyncStamp(col, at?)`, `getCloudChunkCount(col)`, `setCloudChunkCount(col, n)` (usados pelas Tasks 6 e 7).

- [ ] **Step 1: Write the failing test** (acrescentar ao `tests/storageCore.test.ts`)

```ts
import { shouldApplyCloudCollection } from '../src/services/storageCore';

describe('shouldApplyCloudCollection', () => {
  const base = { localStamp: null as string | null, cloudUpdatedAt: undefined as string | undefined };

  it('aplica nuvem quando não há dado local', () => {
    expect(shouldApplyCloudCollection({ ...base, localIsEmpty: true, cloudUpdatedAt: '2026-01-01' })).toBe(true);
  });

  it('NUNCA sobrescreve dado local com nuvem sem carimbo', () => {
    expect(
      shouldApplyCloudCollection({ ...base, localIsEmpty: false, localStamp: '2026-01-01' })
    ).toBe(false);
  });

  it('aplica nuvem mais nova que o carimbo local', () => {
    expect(
      shouldApplyCloudCollection({
        localIsEmpty: false,
        localStamp: '2026-01-01T00:00:00Z',
        cloudUpdatedAt: '2026-02-01T00:00:00Z',
      })
    ).toBe(true);
  });

  it('mantém local mais novo que a nuvem', () => {
    expect(
      shouldApplyCloudCollection({
        localIsEmpty: false,
        localStamp: '2026-03-01T00:00:00Z',
        cloudUpdatedAt: '2026-02-01T00:00:00Z',
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/storageCore.test.ts`
Expected: FAIL — `shouldApplyCloudCollection is not exported`.

- [ ] **Step 3: Implementar em storageCore.ts**

```ts
export type SyncCollection =
  | 'stats'
  | 'nodes'
  | 'relations'
  | 'materials'
  | 'corrections'
  | 'conversations';

/**
 * Decide se o dado da nuvem pode ser aplicado por cima do local. Regras:
 * nuvem vence quando não há dado local, quando não há carimbo local (primeiro
 * login neste dispositivo) ou quando o carimbo da nuvem é mais novo. Nuvem SEM
 * carimbo nunca sobrescreve dado local existente.
 */
export function shouldApplyCloudCollection(opts: {
  localIsEmpty: boolean;
  localStamp: string | null;
  cloudUpdatedAt?: string;
}): boolean {
  if (opts.localIsEmpty) return true;
  if (!opts.cloudUpdatedAt) return false;
  if (!opts.localStamp) return true;
  return opts.cloudUpdatedAt > opts.localStamp;
}

export const SYNC_META_KEY = 'tutor_sync_meta_v1';

export interface SyncMeta {
  stamps: Partial<Record<SyncCollection, string>>;
  cloudChunks: Partial<Record<SyncCollection, number>>;
}

export function readSyncMeta(storageKey: string): SyncMeta {
  return readJsonCached<SyncMeta>(storageKey) ?? { stamps: {}, cloudChunks: {} };
}

export function writeSyncMeta(storageKey: string, meta: SyncMeta): void {
  writeJsonCached(storageKey, meta);
}
```

- [ ] **Step 4: Wrappers em storage.ts + touch nos saves**

Adicionar ao objeto `StorageService` (usa `readSyncMeta`/`writeSyncMeta`/`SYNC_META_KEY` de storageCore):

```ts
  getLocalSyncStamp(col: SyncCollection): string | null {
    return readSyncMeta(this.getKey(SYNC_META_KEY)).stamps[col] || null;
  },

  touchLocalSyncStamp(col: SyncCollection, at: string = new Date().toISOString()) {
    const key = this.getKey(SYNC_META_KEY);
    const meta = readSyncMeta(key);
    meta.stamps[col] = at;
    writeSyncMeta(key, meta);
  },

  getCloudChunkCount(col: SyncCollection): number {
    return readSyncMeta(this.getKey(SYNC_META_KEY)).cloudChunks[col] || 0;
  },

  setCloudChunkCount(col: SyncCollection, count: number) {
    const key = this.getKey(SYNC_META_KEY);
    const meta = readSyncMeta(key);
    meta.cloudChunks[col] = count;
    writeSyncMeta(key, meta);
  },
```

E em cada save de coleção sincronizada, logo após a escrita, registrar a mutação local: `saveStats` → `this.touchLocalSyncStamp('stats')`; `saveNodes` → `'nodes'`; `saveRelations` → `'relations'`; `saveMaterials` → `'materials'`; `saveCorrections` → `'corrections'`; `saveConversations` → `'conversations'`.

- [ ] **Step 5: Quality gates e commit**

Run: `npx vitest run tests/storageCore.test.ts && npm test && npm run lint`
Expected: PASS.

```bash
git add src/services/storageCore.ts src/services/storage.ts tests/storageCore.test.ts
git commit -m "feat(sync): decisão pura de merge por carimbo e meta de sincronização por usuário"
```

---

### Task 6: Hydrate condicional + `updatedAt` na nuvem

**Files:**
- Modify: `src/services/firebase.ts:256-351` (`syncPersonalKnowledgeToCloud`, `fetchPersonalKnowledgeFromCloud`, nova interface `FetchedKnowledgeBase`)
- Modify: `src/services/storage.ts:922-956` (`hydrateFromCloud`)

**Interfaces:**
- Consumes: `shouldApplyCloudCollection`, `SyncCollection` (Task 5).
- Produces: `fetchPersonalKnowledgeFromCloud(userId): Promise<FetchedKnowledgeBase | null>` com `FetchedKnowledgeBase = { data: Partial<UserPersonalKnowledgeBase>; updatedAt: Partial<Record<'stats' | 'nodes' | 'relations' | 'materials' | 'corrections', string>> }`.

- [ ] **Step 1: firebase.ts — carimbar e devolver `updatedAt`**

1. Nova interface exportada junto de `UserPersonalKnowledgeBase`:
   ```ts
   export interface FetchedKnowledgeBase {
     data: Partial<UserPersonalKnowledgeBase>;
     updatedAt: Partial<
       Record<'stats' | 'nodes' | 'relations' | 'materials' | 'corrections', string>
     >;
   }
   ```
2. Em `syncPersonalKnowledgeToCloud`, carimbar também o doc de stats:
   ```ts
   if (data.stats) {
     batch.set(
       doc(db, 'users', userId, 'knowledge_base', 'stats'),
       { ...data.stats, updatedAt: now },
       { merge: true }
     );
   }
   ```
3. Em `fetchPersonalKnowledgeFromCloud`, trocar o tipo de retorno para `Promise<FetchedKnowledgeBase | null>`, criar `const data: Partial<UserPersonalKnowledgeBase> = {};` e `const updatedAt: FetchedKnowledgeBase['updatedAt'] = {};`. No `snap.forEach`, capturar `const cloudStamp = typeof payload.updatedAt === 'string' ? payload.updatedAt : undefined;` e, para cada caso, gravar `data.X` e `updatedAt[col] = cloudStamp`. Para `stats`, remover o carimbo antes de devolver: `const { updatedAt: _drop, ...stats } = payload; data.stats = stats as UserStats;`. Retornar `{ data, updatedAt }`.

- [ ] **Step 2: storage.ts — hydrate condicional**

Substituir o corpo de `hydrateFromCloud` por:

```ts
  async hydrateFromCloud(userId: string): Promise<boolean> {
    if (!userId || userId === 'default_user') return false;

    try {
      const fetched = await fetchPersonalKnowledgeFromCloud(userId);
      if (!fetched) return false;
      const { data, updatedAt } = fetched;

      let hasData = false;
      const applyIfNewer = (col: SyncCollection, apply: () => void): boolean => {
        const localStamp = this.getLocalSyncStamp(col);
        const shouldApply = shouldApplyCloudCollection({
          localIsEmpty: localStamp === null,
          localStamp,
          cloudUpdatedAt: updatedAt[col],
        });
        if (!shouldApply) return false;
        apply();
        // apply() tocou o carimbo com "agora"; restaura o carimbo da nuvem para
        // que a próxima comparação use o instante real do dado aplicado.
        if (updatedAt[col]) this.touchLocalSyncStamp(col, updatedAt[col]);
        return true;
      };

      if (data.stats && applyIfNewer('stats', () => this.saveStats(data.stats!, false))) hasData = true;
      if (data.materials && data.materials.length > 0 && applyIfNewer('materials', () => this.saveMaterials(data.materials!, false))) hasData = true;
      if (data.nodes && data.nodes.length > 0 && applyIfNewer('nodes', () => this.saveNodes(data.nodes!, false))) hasData = true;
      if (data.relations && data.relations.length > 0 && applyIfNewer('relations', () => this.saveRelations(data.relations!, false))) hasData = true;
      if (data.corrections && data.corrections.length > 0 && applyIfNewer('corrections', () => this.saveCorrections(data.corrections!, false))) hasData = true;
      return hasData;
    } catch (err) {
      console.warn('Erro ao hidratar dados da nuvem:', err);
      return false;
    }
  },
```

Importar `shouldApplyCloudCollection` e o tipo `SyncCollection` de `./storageCore`.

- [ ] **Step 3: Quality gates**

Run: `npm run lint && npm test && npm run build`
Expected: PASS (nenhum outro chamador de `fetchPersonalKnowledgeFromCloud` existe — confirmar com grep).

- [ ] **Step 4: Commit**

```bash
git add src/services/firebase.ts src/services/storage.ts
git commit -m "fix(sync): hidrata da nuvem só quando o carimbo remoto é mais novo que o local"
```

---

### Task 7: Chunking do Firestore (teto de 1 MB) + sync de conversas

**Files:**
- Modify: `src/services/firebase.ts` (`syncPersonalKnowledgeToCloud`, `fetchPersonalKnowledgeFromCloud`, helper `writeChunkedCollection`)
- Modify: `src/services/storage.ts` (`scheduleCloudSync` envia conversas e contagem de chunks; `hydrateFromCloud` aplica conversas)

**Interfaces:**
- Consumes: `StorageService.getCloudChunkCount/setCloudChunkCount` (Task 5), `trimConversations` (Task 2).
- Produces: docs `users/{uid}/knowledge_base/{colecao}_{i}` com `{ items, chunkIndex, totalChunks, updatedAt }`; assinatura `syncPersonalKnowledgeToCloud(userId, data, previousChunkCounts?: Partial<Record<string, number>>)`.

- [ ] **Step 1: Verificar regras do Firestore**

Ler `firestore.rules` e confirmar que a regra de `users/{uid}/knowledge_base/{docId}` usa wildcard (qualquer id de doc), não lista fixa de ids. Confirmar que `tests/firestoreRulesContract.test.ts` continua passando depois das mudanças.

- [ ] **Step 2: firebase.ts — helper de chunks**

```ts
const KB_CHUNK_SIZE = 250;
type ChunkableCollection = 'nodes' | 'relations' | 'materials' | 'corrections' | 'conversations';

/**
 * Escreve uma coleção grande em múltiplos docs (chunks) para respeitar o teto
 * de 1 MB por documento do Firestore, apagando chunks excedentes da escrita
 * anterior. Coleções pequenas continuam em 1 doc compatível com o formato
 * legado ({ items, updatedAt }).
 */
function writeChunkedCollection(
  batch: ReturnType<typeof writeBatch>,
  userId: string,
  name: ChunkableCollection,
  items: unknown[],
  updatedAt: string,
  previousChunkCount: number
): number {
  const totalChunks = Math.max(1, Math.ceil(items.length / KB_CHUNK_SIZE));
  for (let i = 0; i < totalChunks; i++) {
    batch.set(doc(db, 'users', userId, 'knowledge_base', `${name}_${i}`), {
      items: items.slice(i * KB_CHUNK_SIZE, (i + 1) * KB_CHUNK_SIZE),
      chunkIndex: i,
      totalChunks,
      updatedAt,
    });
  }
  for (let i = totalChunks; i < previousChunkCount; i++) {
    batch.delete(doc(db, 'users', userId, 'knowledge_base', `${name}_${i}`));
  }
  return totalChunks;
}
```

Em `syncPersonalKnowledgeToCloud`, aceitar terceiro parâmetro `previousChunkCounts: Partial<Record<ChunkableCollection, number>> = {}`, substituir os `batch.set` de arrays por chamadas a `writeChunkedCollection(batch, userId, 'nodes', data.nodes, now, previousChunkCounts.nodes ?? 0)` (idem relations/materials/corrections/conversations). Retornar os `totalChunks` por coleção:

```ts
export async function syncPersonalKnowledgeToCloud(
  userId: string,
  data: Partial<UserPersonalKnowledgeBase>,
  previousChunkCounts: Partial<Record<ChunkableCollection, number>> = {}
): Promise<Partial<Record<ChunkableCollection, number>>> {
  // ... batch igual ao atual, com stats inalterado e cada coleção via
  // writeChunkedCollection; ao final:
  await batch.commit();
  return { nodes: ..., relations: ..., materials: ..., corrections: ..., conversations: ... };
}
```

Remover o `try/catch` que engole o erro **desta** função (o chamador agora emite evento de saúde na Task 8; manter o `console.warn` apenas como log).

- [ ] **Step 3: firebase.ts — reassembly no fetch**

Em `fetchPersonalKnowledgeFromCloud`, antes do `switch` legado, casar ids de chunk:

```ts
const chunks = new Map<ChunkableCollection, Map<number, unknown[]>>();
const chunkStamps = new Map<ChunkableCollection, string>();
snap.forEach((entry) => {
  const payload = entry.data() as Record<string, any>;
  const match = entry.id.match(/^(nodes|relations|materials|corrections|conversations)_(\d+)$/);
  if (match) {
    const col = match[1] as ChunkableCollection;
    if (!chunks.has(col)) chunks.set(col, new Map());
    chunks.get(col)!.set(Number(match[2]), payload.items || []);
    if (typeof payload.updatedAt === 'string') {
      const prev = chunkStamps.get(col);
      if (!prev || payload.updatedAt > prev) chunkStamps.set(col, payload.updatedAt);
    }
    return;
  }
  // ... switch legado existente (docs 'stats', 'nodes', ...) — docs legados sem
  // chunk só são usados quando não há chunks da mesma coleção.
});
for (const [col, byIndex] of chunks) {
  const ordered = [...byIndex.keys()].sort((a, b) => a - b).flatMap((i) => byIndex.get(i)!);
  (data as Record<string, unknown>)[col] = ordered;
  if (chunkStamps.has(col)) updatedAt[col] = chunkStamps.get(col)!;
}
```

Adicionar `'conversations'` ao tipo de `UserPersonalKnowledgeBase` como campo opcional (`conversations?: ChatConversation[]`) e ao `updatedAt` de `FetchedKnowledgeBase`.

- [ ] **Step 4: storage.ts — enviar conversas e gravar contagem de chunks**

Em `scheduleCloudSync`, incluir conversas no payload e capturar o retorno:

```ts
const payload = {
  stats,
  nodes,
  materials,
  relations,
  corrections,
  conversations: trimConversations(this.getConversations()),
};
const previousChunkCounts = {
  nodes: this.getCloudChunkCount('nodes'),
  relations: this.getCloudChunkCount('relations'),
  materials: this.getCloudChunkCount('materials'),
  corrections: this.getCloudChunkCount('corrections'),
  conversations: this.getCloudChunkCount('conversations'),
};
const chunkCounts = await syncPersonalKnowledgeToCloud(_currentUserId, payload, previousChunkCounts);
for (const [col, count] of Object.entries(chunkCounts)) {
  if (typeof count === 'number') this.setCloudChunkCount(col as SyncCollection, count);
}
```

Em `hydrateFromCloud`, acrescentar:

```ts
if (data.conversations && data.conversations.length > 0 && applyIfNewer('conversations', () => this.saveConversations(data.conversations!))) hasData = true;
```

- [ ] **Step 5: Quality gates e commit**

Run: `npm run lint && npm test && npm run build`
Expected: PASS (inclui `firestoreRulesContract`).

```bash
git add src/services/firebase.ts src/services/storage.ts src/types.ts
git commit -m "feat(sync): chunking do Firestore contra o teto de 1MB e sincronização de conversas"
```

---

### Task 8: Status de sync visível + telemetria persistente

**Files:**
- Create: `src/components/SyncStatusIndicator.tsx`
- Modify: `src/services/storage.ts` (`scheduleCloudSync` emite eventos `cloud-sync`)
- Modify: `src/components/Navbar.tsx` (renderizar o indicador)
- Modify: `server/observability/aiTelemetry.ts` (persistência em disco)
- Modify: `server.ts` (habilitar persistência), `.gitignore` (`.telemetry/`)
- Create: `tests/aiTelemetry.test.ts`

- [ ] **Step 1: Emitir eventos de sync em storage.ts**

No `scheduleCloudSync`, dentro do `setTimeout`: em sucesso (após `updateUserStatsSummary`), `emitStorageHealth({ kind: 'cloud-sync', status: 'success', at: new Date().toISOString() });`; no `catch`, `emitStorageHealth({ kind: 'cloud-sync', status: 'error', error: err instanceof Error ? err.message : String(err), at: new Date().toISOString() });` (manter o `console.warn`).

- [ ] **Step 2: Criar o indicador**

```tsx
// src/components/SyncStatusIndicator.tsx
import { useEffect, useState } from 'react';
import { CloudOff, CloudCheck, RefreshCw } from 'lucide-react';
import {
  getLastStorageHealthEvent,
  subscribeStorageHealth,
  type StorageHealthEvent,
} from '../services/storageCore';
import { StorageService } from '../services/storage';

type SyncState = { status: 'success' | 'error'; at: string; error?: string };

/**
 * Ponto de status da sincronização com o Firestore. Erros de sync deixam de
 * ser invisíveis (console.warn) e ganham uma ação de retry com um clique.
 */
export function SyncStatusIndicator() {
  const [state, setState] = useState<SyncState | null>(() => {
    const last = getLastStorageHealthEvent();
    return last?.kind === 'cloud-sync' ? { status: last.status, at: last.at, error: last.error } : null;
  });

  useEffect(() => {
    const unsubscribe = subscribeStorageHealth((event: StorageHealthEvent) => {
      if (event.kind === 'cloud-sync') {
        setState({ status: event.status, at: event.at, error: event.error });
      }
    });
    return unsubscribe;
  }, []);

  if (!state) return null;

  const horario = new Date(state.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
      {state.status === 'success' ? (
        <>
          <CloudCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
          <span>Sincronizado às {horario}</span>
        </>
      ) : (
        <>
          <CloudOff className="h-3.5 w-3.5 text-red-500" aria-hidden="true" />
          <span title={state.error}>Falha ao sincronizar</span>
          <button
            type="button"
            aria-label="Tentar sincronizar novamente"
            className="ml-1 rounded p-0.5 hover:bg-slate-100"
            onClick={() => StorageService.scheduleCloudSync()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </>
      )}
    </div>
  );
}
```

Renderizar dentro do `Navbar.tsx` (área do rodapé do menu desktop ou ao lado do seletor de idioma), importando `SyncStatusIndicator`.

- [ ] **Step 3: Persistência de telemetria**

Em `server/observability/aiTelemetry.ts`, adicionar à classe:

```ts
  private static persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private static persistenceFilePath: string | null = null;

  /** Persiste snapshots periódicos em disco — a telemetria em memória morre no restart. */
  static enablePersistence(filePath: string, intervalMs = 60_000): void {
    if (this.persistenceTimer) return;
    this.persistenceFilePath = filePath;
    void this.loadPersisted(filePath);
    this.persistenceTimer = setInterval(() => {
      void this.flushToDisk();
    }, intervalMs);
    this.persistenceTimer.unref?.();
  }

  static async flushToDisk(): Promise<void> {
    if (!this.persistenceFilePath) return;
    const fs = await import('fs');
    const path = await import('path');
    await fs.promises.mkdir(path.dirname(this.persistenceFilePath), { recursive: true });
    await fs.promises.writeFile(
      this.persistenceFilePath,
      JSON.stringify({ savedAt: new Date().toISOString(), logs: this.logs }, null, 2),
      'utf8'
    );
  }

  static async loadPersisted(filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const raw = await fs.promises.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as { logs?: TutorTelemetryLog[] };
      if (Array.isArray(parsed.logs)) {
        this.logs = parsed.logs.slice(0, this.maxLogs);
      }
    } catch {
      // Sem snapshot anterior — começa vazio.
    }
  }

  static resetForTests(): void {
    this.logs = [];
  }
```

Em `server.ts` (dentro de `startServer`, após criar `app`): `AiTelemetry.enablePersistence(process.env.AI_TELEMETRY_PATH || '.telemetry/ai-telemetry.json');`. Adicionar `.telemetry/` ao `.gitignore`. Acrescentar a variável ao `.env.example` com comentário.

- [ ] **Step 4: Write the failing test primeiro (persistência)**

```ts
// tests/aiTelemetry.test.ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { AiTelemetry } from '../server/observability/aiTelemetry';

const baseLog = {
  requestId: 'r1',
  route: 'chat',
  modelRequested: 'm',
  fallbackIndex: 0,
  degraded: false,
  durationMs: 10,
  inputCharacters: 5,
  language: 'Inglês',
  cefrLevel: 'B1',
  status: 'success' as const,
};

describe('AiTelemetry', () => {
  beforeEach(() => AiTelemetry.resetForTests());

  it('resume métricas agregadas', () => {
    AiTelemetry.record({ ...baseLog });
    AiTelemetry.record({ ...baseLog, status: 'error' });
    const summary = AiTelemetry.getMetricsSummary();
    expect(summary.totalRequests).toBe(2);
    expect(summary.errorRate).toBe(0.5);
  });

  it('flusha e recarrega snapshot do disco', async () => {
    AiTelemetry.record({ ...baseLog });
    const dir = await mkdtemp(join(tmpdir(), 'lingo-telemetry-'));
    const file = join(dir, 'ai-telemetry.json');
    AiTelemetry.enablePersistence(file, 60_000);
    await AiTelemetry.flushToDisk();
    AiTelemetry.resetForTests();
    await AiTelemetry.loadPersisted(file);
    expect(AiTelemetry.getRecentLogs(10)).toHaveLength(1);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    expect(saved.logs).toHaveLength(1);
  });
});
```

Run: `npx vitest run tests/aiTelemetry.test.ts` — o teste de persistência falha até os métodos da Step 3 existirem (implementar antes de rodar, mantendo TDD: escrever teste → falha de compilação → implementar → passa).

- [ ] **Step 5: Quality gates e commit**

Run: `npm run lint && npm test && npm run build`
Expected: PASS.

```bash
git add src/components/SyncStatusIndicator.tsx src/components/Navbar.tsx src/services/storage.ts server/observability/aiTelemetry.ts server.ts .gitignore .env.example tests/aiTelemetry.test.ts
git commit -m "feat(observability): status de sincronização na UI e telemetria persistente"
```

---

### Task 9: SM-2 real — algoritmo puro com ease dinâmico e leech (TDD)

**Files:**
- Create: `src/services/srsAlgorithm.ts`
- Create: `tests/srsAlgorithm.test.ts`
- Modify: `src/types.ts` (campos opcionais em `GraphNode`; `'leech'` no union de `SRSFlashcard['status_srs']`)
- Modify: `src/services/flashcardsEngine.ts` (delegar a matemática; persistir estado SRS no nó; filtrar suspensos)

**Interfaces:**
- Produces: `computeSM2Next(state: SM2State, grade: SRSGrade): SM2Next` com `SM2State = { intervalo_dias, repeticoes, fator_facilidade, frequencia_erro }` e `SM2Next` incluindo `repetir_hoje: boolean` e `suspender: boolean`. `GraphNode` ganha `srs_fator_facilidade?: number; srs_intervalo_dias?: number; srs_repeticoes?: number; srs_suspenso?: boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/srsAlgorithm.test.ts
import { describe, expect, it } from 'vitest';
import { computeSM2Next, SM2_DEFAULTS } from '../src/services/srsAlgorithm';

describe('computeSM2Next (SM-2)', () => {
  it('grade 3 (Bom) em card novo: intervalo 1d, EF inalterado (2.5)', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 3);
    expect(next.repeticoes).toBe(1);
    expect(next.intervalo_dias).toBe(1);
    expect(next.fator_facilidade).toBeCloseTo(2.5);
    expect(next.repetir_hoje).toBe(false);
  });

  it('grade 4 (Fácil) em card novo: EF sobe para 2.6', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 4);
    expect(next.repeticoes).toBe(1);
    expect(next.intervalo_dias).toBe(1);
    expect(next.fator_facilidade).toBeCloseTo(2.6);
  });

  it('grade 1 (Novamente): zera sequência, repete hoje, EF cai para 1.96', () => {
    const next = computeSM2Next({ ...SM2_DEFAULTS }, 1);
    expect(next.repeticoes).toBe(0);
    expect(next.intervalo_dias).toBe(0);
    expect(next.repetir_hoje).toBe(true);
    expect(next.fator_facilidade).toBeCloseTo(1.96);
    expect(next.frequencia_erro).toBe(1);
  });

  it('segunda revisão boa: intervalo salta para 6 dias', () => {
    const next = computeSM2Next({ intervalo_dias: 1, repeticoes: 1, fator_facilidade: 2.5, frequencia_erro: 0 }, 3);
    expect(next.intervalo_dias).toBe(6);
  });

  it('revisões seguintes: intervalo × EF arredondado', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 0 }, 3);
    expect(next.intervalo_dias).toBe(15);
  });

  it('EF nunca fica abaixo de 1.3', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 1.3, frequencia_erro: 0 }, 1);
    expect(next.fator_facilidade).toBe(1.3);
  });

  it('suspende leech: 5º erro consecutivo em falha', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 4 }, 1);
    expect(next.suspender).toBe(true);
    expect(next.intervalo_dias).toBe(30);
  });

  it('acerto reduz a frequência de erro e não suspende', () => {
    const next = computeSM2Next({ intervalo_dias: 6, repeticoes: 2, fator_facilidade: 2.5, frequencia_erro: 4 }, 3);
    expect(next.suspender).toBe(false);
    expect(next.frequencia_erro).toBe(3);
  });

  it('intervalo máximo é 365 dias', () => {
    const next = computeSM2Next({ intervalo_dias: 300, repeticoes: 10, fator_facilidade: 2.8, frequencia_erro: 0 }, 4);
    expect(next.intervalo_dias).toBeLessThanOrEqual(365);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/srsAlgorithm.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `src/services/srsAlgorithm.ts`**

```ts
import type { SRSGrade } from '../types';

export interface SM2State {
  intervalo_dias: number;
  repeticoes: number;
  fator_facilidade: number;
  frequencia_erro: number;
}

export interface SM2Next {
  intervalo_dias: number;
  repeticoes: number;
  fator_facilidade: number;
  frequencia_erro: number;
  repetir_hoje: boolean;
  suspender: boolean;
}

export const SM2_DEFAULTS: SM2State = {
  intervalo_dias: 1,
  repeticoes: 0,
  fator_facilidade: 2.5,
  frequencia_erro: 0,
};

const MIN_EF = 1.3;
const MAX_INTERVALO_DIAS = 365;
const LEECH_ERROS = 5;
const LEECH_INTERVALO_DIAS = 30;

/**
 * SM-2 clássico: EF' = EF + (0.1 - (5-q) × (0.08 + (5-q) × 0.02)); intervalos
 * 1d → 6d → intervalo × EF; falha zera a sequência e repete no mesmo dia.
 * Mapeamento de nota: 1=Novamente(q1), 2=Difícil(q3), 3=Bom(q4), 4=Fácil(q5).
 * A "qualidade de resposta" é derivada da grade; os deltas de domínio/XP
 * continuam no flashcardsEngine.
 */
export function computeSM2Next(state: SM2State, grade: SRSGrade): SM2Next {
  const q = grade === 1 ? 1 : grade === 2 ? 3 : grade === 3 ? 4 : 5;
  let { intervalo_dias, repeticoes } = state;
  let fator_facilidade = Math.max(
    MIN_EF,
    state.fator_facilidade + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );
  let frequencia_erro = state.frequencia_erro;

  let repetir_hoje = false;
  if (q < 3) {
    repeticoes = 0;
    intervalo_dias = 0;
    repetir_hoje = true;
    frequencia_erro += 1;
  } else {
    repeticoes += 1;
    if (repeticoes === 1) intervalo_dias = 1;
    else if (repeticoes === 2) intervalo_dias = 6;
    else intervalo_dias = Math.min(MAX_INTERVALO_DIAS, Math.round(intervalo_dias * fator_facilidade));
    if (frequencia_erro > 0) frequencia_erro -= 1;
  }

  const suspender = frequencia_erro >= LEECH_ERROS;
  if (suspender) intervalo_dias = LEECH_INTERVALO_DIAS;

  return { intervalo_dias, repeticoes, fator_facilidade, frequencia_erro, repetir_hoje, suspender };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/srsAlgorithm.test.ts`
Expected: PASS nos 9 casos.

- [ ] **Step 5: Ligar no flashcardsEngine e nos tipos**

1. `src/types.ts`: em `GraphNode` adicionar `srs_fator_facilidade?: number; srs_intervalo_dias?: number; srs_repeticoes?: number; srs_suspenso?: boolean;`. No tipo de `SRSFlashcard`, estender o union de `status_srs` com `'leech'`.
2. `src/services/flashcardsEngine.ts`: importar `computeSM2Next` e `SM2_DEFAULTS` de `./srsAlgorithm`. Em `convertNodeToFlashcard`, usar o estado persistido com fallback aos defaults atuais:
   ```ts
   intervalo_dias: node.srs_intervalo_dias ?? (node.dominio_estimado > 70 ? 4 : 1),
   repeticoes: node.srs_repeticoes ?? Math.max(0, Math.floor((node.dominio_estimado ?? 0) / 25)),
   fator_facilidade: node.srs_fator_facilidade ?? SM2_DEFAULTS.fator_facilidade,
   ```
   e `status_srs: node.srs_suspenso ? 'leech' : status_srs`.
3. `getFlashcardsFromGraph`: excluir suspensos do deck — no filtro de idioma, acrescentar `&& !node.srs_suspenso`.
4. `processReview`: substituir o `switch (grade)` de intervalos por:
   ```ts
   const sm2 = computeSM2Next(
     {
       intervalo_dias: card.intervalo_dias || 1,
       repeticoes: card.repeticoes ?? 0,
       fator_facilidade: card.fator_facilidade || 2.5,
       frequencia_erro: card.frequencia_erro ?? 0,
     },
     grade
   );
   ```
   Manter os deltas de `dominio` e `xp_ganho` como estão hoje; usar `sm2.intervalo_dias` como `novo_intervalo_dias`, `sm2.repetir_hoje` como `repeatInSession`, `sm2.frequencia_erro` como `nova_frequencia_erro`. No update do `targetNode`, persistir também `srs_fator_facilidade: sm2.fator_facilidade`, `srs_intervalo_dias: sm2.intervalo_dias`, `srs_repeticoes: sm2.repeticoes`, `srs_suspenso: sm2.suspender || Boolean(targetNode.srs_suspenso)`. Em `updatedCard`, `status_srs: sm2.suspender ? 'leech' : novoStatus`.
5. Em `FlashcardsView.tsx`, localizar onde `status_srs` vira rótulo/badge (grep `status_srs`) e acrescentar o caso `'leech'` → "Em pausa (leech)".

- [ ] **Step 6: Quality gates e commit**

Run: `npx vitest run tests/srsAlgorithm.test.ts && npm test && npm run lint && npm run build`
Expected: PASS (inclui `achievementIntegrity` e `emptyStateIntegrity` — nenhuma conquista depende dos intervalos).

```bash
git add src/services/srsAlgorithm.ts tests/srsAlgorithm.test.ts src/types.ts src/services/flashcardsEngine.ts src/components/FlashcardsView.tsx
git commit -m "feat(srs): SM-2 com fator de facilidade dinâmico, histórico real e suspensão de leeches"
```

---

# Onda 3 — Custo, escala e polimento (Melhorias ICE #5, #7, #9, #10)

### Task 10: Pin de comportamento do `GeminiResponseCache`

**Files:**
- Create: `tests/geminiCache.test.ts`

- [ ] **Step 1: Write the tests**

```ts
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
    expect(calls).toBe(4);
    await cache.run('b', produce(22)); // ainda em cache → sem produce
    expect(calls).toBe(4);
  });
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run tests/geminiCache.test.ts`
Expected: PASS (teste de pinagem — o código já existe; se algo falhar, é bug real a corrigir no `geminiCache.ts`, não no teste).

- [ ] **Step 3: Commit**

```bash
git add tests/geminiCache.test.ts
git commit -m "test(ai): pin de comportamento do cache LRU com coalescimento"
```

---

### Task 11: Unificar retry Gemini em `generateWithFallback` (TDD) + telemetria

**Files:**
- Create: `server/ai/generateWithFallback.ts`
- Create: `tests/generateWithFallback.test.ts`
- Modify: `server.ts:41-143` (remover cópia local; usar o helper), todos os call sites inline
- Modify: `server/observability/aiTelemetry.ts` (tornar `language`/`cefrLevel`/`historyItems`/`memoryItems` opcionais; adicionar `outputCharacters?`)

**Interfaces:**
- Produces: `generateWithFallback(options: { client: GoogleGenAI; params: { model?: string; contents: any; config?: any }; fallbackModels?: string[]; route: string; requestId?: string; timeoutMs?: number }): Promise<any>` — assinatura que as Tasks 12/13 usam nos módulos extraídos.

- [ ] **Step 1: Write the failing test (client falso)**

```ts
// tests/generateWithFallback.test.ts
import { describe, expect, it } from 'vitest';
import { generateWithFallback } from '../server/ai/generateWithFallback';

function fakeClient(behavior: Record<string, () => Promise<any>>) {
  return {
    models: {
      generateContent: async (params: { model: string }) => {
        const fn = behavior[params.model];
        if (!fn) throw new Error(`modelo inesperado ${params.model}`);
        return fn();
      },
    },
  } as any;
}

const err503 = () => Promise.reject(new Error('503 UNAVAILABLE: high demand'));

describe('generateWithFallback', () => {
  it('cai para o fallback em 503 e registra degraded', async () => {
    const client = fakeClient({ 'modelo-a': err503, 'modelo-b': async () => ({ ok: true }) });
    const res = await generateWithFallback({
      client,
      params: { contents: 'oi' },
      route: 'word-context',
      fallbackModels: ['modelo-b'],
    });
    expect(res).toEqual({ ok: true });
  });

  it('pula modelo em cooldown recente de 503', async () => {
    const client = fakeClient({
      'modelo-a': err503,
      'modelo-b': async () => ({ ok: 'b1' }),
    });
    await generateWithFallback({ client, params: {}, route: 'x', fallbackModels: ['modelo-b'] });
    // Segunda chamada: 'modelo-a' está em cooldown; nem deve ser tentado.
    const client2 = fakeClient({
      'modelo-a': async () => { throw new Error('não deveria ser chamado'); },
      'modelo-b': async () => ({ ok: 'b2' }),
    });
    const res = await generateWithFallback({ client: client2, params: {}, route: 'x', fallbackModels: ['modelo-b'] });
    expect(res).toEqual({ ok: 'b2' });
  });

  it('erro não-transitório não aciona cooldown e propaga o último erro', async () => {
    const client = fakeClient({ 'modelo-a': () => Promise.reject(new Error('API key inválida')) });
    await expect(
      generateWithFallback({ client, params: {}, route: 'x', fallbackModels: [] })
    ).rejects.toThrow('API key inválida');
  });
});
```

> Observação: cada `it(...)` é um teste normal — o rótulo de grupo acima é só texto.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/generateWithFallback.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

Criar `server/ai/generateWithFallback.ts` **movendo o algoritmo de `server.ts:44-143`** (`modelCooldownMap` + `generateContentWithRetryAndFallback`) para dentro da nova função, com as diferenças: timeout de `options.timeoutMs ?? 60000`, `route`/`requestId` para telemetria e registro `AiTelemetry.record(...)` no sucesso e no erro final:

```ts
import type { GoogleGenAI } from '@google/genai';
import { AiTelemetry } from '../observability/aiTelemetry';

/** Cooldown de modelos em 503/429 — evita insistir em endpoint sobrecarregado. */
const modelCooldownMap = new Map<string, number>();

export interface GenerateWithFallbackOptions {
  client: GoogleGenAI;
  params: { model?: string; contents: any; config?: any };
  fallbackModels?: string[];
  route: string;
  requestId?: string;
  timeoutMs?: number;
}

export async function generateWithFallback(options: GenerateWithFallbackOptions): Promise<any> {
  const preferredModel = options.params.model || 'gemini-3.7-flash';
  const fallbackModels = options.fallbackModels || ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.7-flash'];
  // ... corpo idêntico ao de server.ts:62-143 (ordenação por cooldown, timeout
  // por tentativa com AbortController, detecção 503/429), com:
  //  - perAttemptTimeoutMs = options.timeoutMs ?? 60000 (GEMINI_TIMEOUT_MS continua valendo via chamador)
  //  - AiTelemetry.record({ requestId, route: options.route, modelRequested: preferredModel,
  //      modelUsed: modelName, fallbackIndex: índice, degraded: modelName !== preferredModel,
  //      durationMs, inputCharacters: JSON.stringify(options.params.contents ?? '').length,
  //      status: 'success' | 'error', errorCode }) no sucesso de cada modelo e no throw final.
}
```

Em `server.ts`: **deletar** `modelCooldownMap`, `generateContentWithRetryAndFallback` e o `wordContextCache` local (a Task 12 o move); importar `generateWithFallback` e trocar cada call site inline (materials, tts, word-context, calendar, recommendation, priority-topics, onboarding — grep `generateContentWithRetryAndFallback` para listar todos) por:

```ts
generateWithFallback({ client, params: { model, contents, config }, route: 'materials', requestId })
```

com `route` próprio por endpoint. Em `aiTelemetry.ts`, tornar `language?`, `cefrLevel?`, `historyItems?`, `memoryItems?` opcionais em `TutorTelemetryLog` e adicionar `outputCharacters?: number`.

- [ ] **Step 4: Run tests e quality gates**

Run: `npx vitest run tests/generateWithFallback.test.ts && npm test && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/ai/generateWithFallback.ts tests/generateWithFallback.test.ts server.ts server/observability/aiTelemetry.ts
git commit -m "refactor(ai): unifica retry/fallback do Gemini num helper com telemetria"
```

---

### Task 12: Extrair rotas `word-context` e `tts` do monolito

**Files:**
- Create: `server/routes/wordContext.ts`, `server/routes/tts.ts`
- Modify: `server.ts` (remover handlers inline de `server.ts:396-517` e `server.ts:522-721`; montar routers)

**Interfaces:**
- Consumes: `generateWithFallback` (Task 11), padrão de fábrica igual ao `chatRouter` de `server/routes/chat.ts:10`.
- Produces: `createWordContextRouter(getClient: () => GoogleGenAI | null): express.Router`, `createTtsRouter(getClient: () => GoogleGenAI | null): express.Router`.

- [ ] **Step 1: Extrair word-context** — mover o corpo do handler de `server.ts:396-517` verbatim para:

```ts
// server/routes/wordContext.ts
import express from 'express';
import type { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../ai/generateWithFallback';
import { GeminiResponseCache } from '../ai/geminiCache';

export function createWordContextRouter(getClient: () => GoogleGenAI | null): express.Router {
  const router = express.Router();
  // LRU de contextos de palavra: cliques repetidos não viram cobrança nova.
  const wordContextCache = new GeminiResponseCache<any>(500, 10 * 60_000);

  router.post('/', async (req, res) => {
    // corpo movido de server.ts:396-517, trocando
    // generateContentWithRetryAndFallback(...) por generateWithFallback({ client, params, route: 'word-context', requestId })
    // e getGeminiClient() por getClient()
  });

  return router;
}
```

- [ ] **Step 2: Extrair tts** — mesmo padrão para `server.ts:522-721` (o estado `ttsAuthFailedUntil`/`isTtsAuthFailed`/`markTtsAuthFailed` de `server.ts:50-56` move-se para dentro da fábrica; rota `route: 'tts'`).

- [ ] **Step 3: Montar em server.ts e apagar o inline**

```ts
import { createWordContextRouter } from './server/routes/wordContext';
import { createTtsRouter } from './server/routes/tts';
// ...
app.use('/api/word-context', createWordContextRouter(getGeminiClient));
app.use('/api/tts', createTtsRouter(getGeminiClient));
```

Verificar com grep que não restou nenhuma referência aos handlers removidos.

- [ ] **Step 4: Quality gates e commit**

Run: `npm run lint && npm test && npm run build && npm run dev &` + smoke: `curl -s localhost:3000/api/health` (espera `{"status":"ok"...}`); matar o processo.

```bash
git add server/routes/wordContext.ts server/routes/tts.ts server.ts
git commit -m "refactor(server): extrai rotas word-context e tts do monolito"
```

---

### Task 13: Extrair rotas de geração e insights do monolito

**Files:**
- Create: `server/routes/materials.ts` (POST `/api/materials/generate` — corpo de `server.ts:201-385`), `server/routes/onboarding.ts` (POST `/generate-plan` — `server.ts:971-1266`), `server/routes/insights.ts` (`/api/calendar/suggest`, `/api/recommendation`, `/api/dashboard/priority-topics` — `server.ts:740-970`)
- Modify: `server.ts` (remover os handlers; montar os routers)

- [ ] **Step 1: Extrair materials** — mesma fábrica da Task 12 (`createMaterialsRouter(getClient)`), corpo movido verbatim, `route: 'materials'` no `generateWithFallback`.

- [ ] **Step 2: Extrair onboarding** — `createOnboardingRouter(getClient)`, `route: 'onboarding'`.

- [ ] **Step 3: Extrair insights** — `createInsightsRouter(getClient)` com os três POSTs (`/calendar/suggest`, `/recommendation`, `/dashboard/priority-topics`), `route: 'calendar' | 'recommendation' | 'priority-topics'`.

- [ ] **Step 4: Montar e conferir** — `app.use('/api/materials/generate', createMaterialsRouter(getGeminiClient));` etc. (preservar os paths exatos). `server.ts` deve terminar com bootstrap + health/telemetry + static/Vite + WS Live (~450-500 linhas).

Run: `npm run lint && npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/materials.ts server/routes/onboarding.ts server/routes/insights.ts server.ts
git commit -m "refactor(server): extrai rotas de geração e insights do monolito"
```

---

### Task 14: Cotas diárias por usuário + limites de sessão Live (TDD)

**Files:**
- Create: `server/middleware/userQuota.ts`, `tests/userQuota.test.ts`
- Modify: `server.ts` (montar cotas em materials/onboarding; limites por usuário no WS Live ~`server.ts:1289-1318`)
- Modify: `.env.example` (novos limites)

**Interfaces:**
- Produces: `createUserDailyQuota(limitPerDay: number, now?: () => Date): (req, res, next) => void` — 429 com `code: 'DAILY_QUOTA_EXCEEDED'` quando o uid atinge o limite no dia.

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/userQuota.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Montar no server.ts e endurecer o Live**

1. Antes das rotas de geração:
   ```ts
   const materialsQuota = createUserDailyQuota(Number(process.env.AI_DAILY_MATERIALS_LIMIT) || 20);
   const onboardingQuota = createUserDailyQuota(Number(process.env.AI_DAILY_ONBOARDING_LIMIT) || 10);
   ```
   Montar como middleware na frente de cada router extraído: `app.use('/api/materials/generate', materialsQuota, jsonLimiter(6), createMaterialsRouter(getGeminiClient));` e o equivalente para onboarding (limites de burst de 6/min, mais apertados que o global).
2. No handler WS Live (`server.ts:1292`), declarar o estado **no escopo do servidor** (ao lado de `liveConnectionsByIp`, linha ~1289) e aplicar o limite **por usuário** e duração máxima dentro do handler, além do limite por IP existente:
   ```ts
   // escopo do servidor (ao lado de liveConnectionsByIp):
   const liveConnectionsByUser = new Map<string, number>();
   const MAX_LIVE_CONNECTIONS_PER_USER = 1;
   const MAX_LIVE_SESSION_MS = 30 * 60_000;

   // dentro do handler, após autenticar:
   const uid = firebaseUser.sub;
   const activeForUser = liveConnectionsByUser.get(uid) ?? 0;
   if (activeForUser >= MAX_LIVE_CONNECTIONS_PER_USER) {
     clientWs.close(4408, 'TOO_MANY_CONNECTIONS');
     return;
   }
   liveConnectionsByUser.set(uid, activeForUser + 1);
   const sessionTimer = setTimeout(() => clientWs.close(1000, 'SESSION_LIMIT'), MAX_LIVE_SESSION_MS);
   // no clientWs.on('close') existente, acrescentar:
   clearTimeout(sessionTimer);
   const n = liveConnectionsByUser.get(uid) ?? 1;
   if (n <= 1) liveConnectionsByUser.delete(uid);
   else liveConnectionsByUser.set(uid, n - 1);
   ```
3. `.env.example`:
   ```
   # Limite diário por usuário de gerações pesadas de IA (padrões: 20 materiais, 10 planos).
   AI_DAILY_MATERIALS_LIMIT="20"
   AI_DAILY_ONBOARDING_LIMIT="10"

   # Caminho do snapshot de telemetria de IA (persistido a cada 60s).
   AI_TELEMETRY_PATH=".telemetry/ai-telemetry.json"
   ```

- [ ] **Step 5: Quality gates e commit**

Run: `npx vitest run tests/userQuota.test.ts && npm test && npm run lint && npm run build`
Expected: PASS.

```bash
git add server/middleware/userQuota.ts tests/userQuota.test.ts server.ts .env.example
git commit -m "feat(server): cotas diárias por usuário e limites de sessão Live"
```

---

### Task 15: Contabilidade de uso por rota no `/api/telemetry`

**Files:**
- Modify: `server/observability/aiTelemetry.ts` (`getUsageByRoute`)
- Modify: `server.ts:175-180` (expor no endpoint admin)
- Modify: `server/routes/chat.ts` (preencher `outputCharacters`)
- Modify: `tests/aiTelemetry.test.ts`

- [ ] **Step 1: Write the failing test** (acrescentar ao `tests/aiTelemetry.test.ts`)

```ts
it('agrega uso por rota', () => {
  AiTelemetry.record({ ...baseLog, route: 'chat', inputCharacters: 100, outputCharacters: 300 });
  AiTelemetry.record({ ...baseLog, route: 'tts', inputCharacters: 50, outputCharacters: 0 });
  AiTelemetry.record({ ...baseLog, route: 'chat', inputCharacters: 10, outputCharacters: 40, status: 'error' });
  const usage = AiTelemetry.getUsageByRoute();
  expect(usage['chat']).toEqual({ requests: 2, inputCharacters: 110, outputCharacters: 340, degraded: 0, errors: 1 });
  expect(usage['tts']).toEqual({ requests: 1, inputCharacters: 50, outputCharacters: 0, degraded: 0, errors: 0 });
});
```

- [ ] **Step 2: Implementar**

```ts
static getUsageByRoute(): Record<
  string,
  { requests: number; inputCharacters: number; outputCharacters: number; degraded: number; errors: number }
> {
  const byRoute: Record<string, { requests: number; inputCharacters: number; outputCharacters: number; degraded: number; errors: number }> = {};
  for (const log of this.logs) {
    const entry = (byRoute[log.route] ||= { requests: 0, inputCharacters: 0, outputCharacters: 0, degraded: 0, errors: 0 });
    entry.requests += 1;
    entry.inputCharacters += log.inputCharacters || 0;
    entry.outputCharacters += log.outputCharacters || 0;
    if (log.degraded) entry.degraded += 1;
    if (log.status === 'error') entry.errors += 1;
  }
  return byRoute;
}
```

Em `server.ts`, acrescentar `usageByRoute: AiTelemetry.getUsageByRoute(),` à resposta de `/api/telemetry`. Em `chat.ts`, no `AiTelemetry.record` final, incluir `outputCharacters: fullText.length`.

- [ ] **Step 3: Quality gates e commit**

Run: `npx vitest run tests/aiTelemetry.test.ts && npm test && npm run lint`
Expected: PASS.

```bash
git add server/observability/aiTelemetry.ts server.ts server/routes/chat.ts tests/aiTelemetry.test.ts
git commit -m "feat(observability): contabilidade de uso de IA por rota no /api/telemetry"
```

---

### Task 16: Acessibilidade residual — skip-link, reduced-motion, aria audit

**Files:**
- Create: `src/components/SkipLink.tsx`
- Modify: `src/App.tsx` (renderizar SkipLink; `id` no conteúdo principal)
- Modify: `src/index.css` (bloco `prefers-reduced-motion`)
- Modify: `src/components/Navbar.tsx`, `src/components/ChatTutor.tsx` e demais views (aria-labels em botões de ícone)
- Modify: `tests/accessibilityContracts.test.ts` (novas asserções)

- [ ] **Step 1: SkipLink**

```tsx
// src/components/SkipLink.tsx
/** Link de pular navegação: primeiro elemento focável da página. */
export function SkipLink() {
  return (
    <a
      href="#conteudo-principal"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white"
    >
      Pular para o conteúdo principal
    </a>
  );
}
```

Em `App.tsx`: renderizar `<SkipLink />` como primeiro elemento e adicionar `id="conteudo-principal"` no wrapper principal do conteúdo (o container que troca de view).

- [ ] **Step 2: Reduced motion** — acrescentar ao final de `src/index.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 3: Audit de botões de ícone** — localizar botões puramente icônicos sem nome acessível: `grep -rn 'size="icon"' src/components/` e `grep -rn '<button' src/components/` (inspecionar cada ocorrência e o elemento seguinte); para cada um sem `aria-label` (concentração conhecida: `Navbar.tsx` menu mobile, `ChatTutor.tsx` mic/enviar/copiar, `UserProfileMenu.tsx` trigger, `MaterialsView.tsx` ações de card), acrescentar `aria-label` descritivo em PT-BR. Nenhum botão pode ficar sem nome acessível.

- [ ] **Step 4: Estender os contratos de acessibilidade** (seguir o padrão de leitura de source já usado em `tests/accessibilityContracts.test.ts`):

```ts
it('App oferece skip-link e alvo de conteúdo principal', () => {
  expect(appSource).toContain('SkipLink');
  expect(appSource).toContain('id="conteudo-principal"');
});

it('CSS respeita prefers-reduced-motion', () => {
  expect(cssSource).toContain('prefers-reduced-motion');
});
```

- [ ] **Step 5: Quality gates e commit**

Run: `npm test && npm run lint && npm run build`
Expected: PASS.

```bash
git add src/components/SkipLink.tsx src/App.tsx src/index.css src/components tests/accessibilityContracts.test.ts
git commit -m "a11y: skip-link, prefers-reduced-motion e labels em botões de ícone"
```

---

## Mapeamento Melhorias ICE → Tasks

| # | Melhoria (ICE) | Tasks |
|---|----------------|-------|
| 1 | Resiliência do armazenamento local (800) | 1, 2 |
| 2 | CI + higiene de repositório (720) | 3 |
| 3 | Deploy/config e segredos (560) | 4 |
| 4 | Sync Firestore correto (540) | 5, 6, 7 |
| 5 | Testes nos núcleos (540) | 1, 2, 5, 9, 10, 11, 14, 15 |
| 6 | Erros visíveis + monitoramento (504) | 8 |
| 7 | Controle de custo por usuário (486) | 11, 14, 15 |
| 8 | SM-2 real (384) | 9 |
| 9 | A11y + prep i18n (324) | 16 |
| 10 | Refatorar server.ts (315) | 11, 12, 13 |

## Riscos e notas de execução

- **Tasks 12/13 movem código verbatim** de `server.ts` — as linhas citadas são do estado atual do repo; ao cortar, confirmar os limites reais do handler no arquivo (o grep do nome do endpoint é a fonte da verdade, não o número de linha).
- **Task 7 depende de regras do Firestore** em produção: os chunk docs só sincronizam se as rules publicadas usarem wildcard para `knowledge_base`. O deploy das rules continua sendo gate humano (ver spec de 2026-08-30).
- **Cotas in-memory (Task 14)** protegem custo em um único processo; com múltiplas réplicas seria necessário store compartilhado — fora de escopo deste plano.
- **Estado híbrido de sync (Tasks 6/7)**: na primeira execução após o deploy, dispositivos existentes não têm carimbo local → a nuvem aplica (comportamento correto, igual ao de hoje). A proteção contra overwrite só ativa a partir daí.
