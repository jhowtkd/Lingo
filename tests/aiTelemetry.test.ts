import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AiTelemetry } from '../server/observability/aiTelemetry';

const baseLog = {
  requestId: 'r1',
  route: 'chat',
  modelRequested: 'm',
  fallbackIndex: 0,
  degraded: false,
  durationMs: 10,
  inputCharacters: 5,
  historyItems: 0,
  memoryItems: 0,
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

  it('agrega uso por rota', () => {
    AiTelemetry.record({ ...baseLog, route: 'chat', inputCharacters: 100, outputCharacters: 300 });
    AiTelemetry.record({ ...baseLog, route: 'tts', inputCharacters: 50, outputCharacters: 0 });
    AiTelemetry.record({ ...baseLog, route: 'chat', inputCharacters: 10, outputCharacters: 40, status: 'error' });
    const usage = AiTelemetry.getUsageByRoute();
    expect(usage['chat']).toEqual({ requests: 2, inputCharacters: 110, outputCharacters: 340, degraded: 0, errors: 1 });
    expect(usage['tts']).toEqual({ requests: 1, inputCharacters: 50, outputCharacters: 0, degraded: 0, errors: 0 });
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

  it('não rejeita quando o flush falha (erro engolido e logado)', async () => {
    // Caminho impossível: um ARQUIVO no meio do caminho faz o mkdir falhar
    // (ENOTDIR), simulando disco cheio / permissão negada. Se flushToDisk
    // rejeitasse, o flush periódico viraria unhandled rejection e crasharia
    // o servidor no Node moderno.
    const dir = await mkdtemp(join(tmpdir(), 'lingo-telemetry-bad-'));
    const blocker = join(dir, 'blocker.txt');
    await writeFile(blocker, 'x', 'utf8');
    AiTelemetry.enablePersistence(join(blocker, 'sub', 'ai-telemetry.json'), 60_000);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      // Deve resolver (engolir + logar), nunca rejeitar.
      await expect(AiTelemetry.flushToDisk()).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith(
        '[Telemetry] Falha ao persistir snapshot:',
        expect.any(Error)
      );
    } finally {
      errorSpy.mockRestore();
    }
  });
});
