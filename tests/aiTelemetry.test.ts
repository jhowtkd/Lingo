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
