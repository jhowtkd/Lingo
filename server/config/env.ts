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
