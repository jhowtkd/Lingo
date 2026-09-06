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
