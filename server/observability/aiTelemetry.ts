export interface TutorTelemetryLog {
  requestId: string;
  route: string;
  modelRequested: string;
  modelUsed?: string;
  fallbackIndex: number;
  degraded: boolean;
  durationMs: number;
  timeToFirstChunkMs?: number;
  inputCharacters: number;
  // Campos de contexto do chat tutor — opcionais porque endpoints que não
  // têm sessão de chat (ex: word-context, tts, calendar) não os preenchem.
  historyItems?: number;
  memoryItems?: number;
  language?: string;
  cefrLevel?: string;
  // Tamanho da resposta do modelo em caracteres (preenchido quando disponível).
  outputCharacters?: number;
  status: 'success' | 'degraded' | 'error';
  errorCode?: string;
}

export class AiTelemetry {
  private static logs: TutorTelemetryLog[] = [];
  private static maxLogs = 200;
  private static persistenceTimer: ReturnType<typeof setInterval> | null = null;
  private static persistenceFilePath: string | null = null;

  static record(log: TutorTelemetryLog): void {
    // Registra métricas agregadas e estruturadas sem vazar dados brutos de mensagens ou PII
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const level = log.status === 'error' ? 'warn' : 'info';
    console[level](
      `[AI Telemetry] [${log.route}] req=${log.requestId} lang=${log.language ?? '-'} cefr=${log.cefrLevel ?? '-'} model=${log.modelUsed || log.modelRequested} degraded=${log.degraded} dur=${log.durationMs}ms ttft=${log.timeToFirstChunkMs || '-'}ms status=${log.status}`
    );
  }

  static getRecentLogs(limit = 50): TutorTelemetryLog[] {
    return this.logs.slice(0, limit);
  }

  static getMetricsSummary() {
    const total = this.logs.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        avgDurationMs: 0,
        degradedRate: 0,
        errorRate: 0,
      };
    }

    const degradedCount = this.logs.filter((l) => l.degraded).length;
    const errorCount = this.logs.filter((l) => l.status === 'error').length;
    const totalDuration = this.logs.reduce((acc, l) => acc + l.durationMs, 0);

    return {
      totalRequests: total,
      avgDurationMs: Math.round(totalDuration / total),
      degradedRate: Math.round((degradedCount / total) * 100) / 100,
      errorRate: Math.round((errorCount / total) * 100) / 100,
    };
  }

  /** Contabilidade de uso por rota: requisições, caracteres de entrada/saída, degradações e erros. */
  static getUsageByRoute(): Record<
    string,
    { requests: number; inputCharacters: number; outputCharacters: number; degraded: number; errors: number }
  > {
    const byRoute: Record<
      string,
      { requests: number; inputCharacters: number; outputCharacters: number; degraded: number; errors: number }
    > = {};
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

  /** Persiste snapshots periódicos em disco — a telemetria em memória morre no restart. */
  static enablePersistence(filePath: string, intervalMs = 60_000): void {
    if (this.persistenceTimer) return;
    this.persistenceFilePath = filePath;
    void this.loadPersisted(filePath);
    this.persistenceTimer = setInterval(() => {
      // Fire-and-forget, mas com erro tratado: rejeição não tratada crasha o
      // processo no Node moderno (unhandled-rejections=throw).
      this.flushToDisk().catch((err) => console.error('[Telemetry] Falha ao persistir snapshot:', err));
    }, intervalMs);
    this.persistenceTimer.unref?.();
  }

  static async flushToDisk(): Promise<void> {
    if (!this.persistenceFilePath) return;
    try {
      const fs = await import('fs');
      const path = await import('path');
      await fs.promises.mkdir(path.dirname(this.persistenceFilePath), { recursive: true });
      await fs.promises.writeFile(
        this.persistenceFilePath,
        JSON.stringify({ savedAt: new Date().toISOString(), logs: this.logs }, null, 2),
        'utf8'
      );
    } catch (err) {
      // Falha de disco (cheio, permissão, ENOTDIR) jamais pode rejeitar para fora.
      console.error('[Telemetry] Falha ao persistir snapshot:', err);
    }
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
    // Isolamento completo entre testes: sem timer vazando e sem caminho
    // residual, cada teste pode reconfigurar a persistência do zero.
    if (this.persistenceTimer) {
      clearInterval(this.persistenceTimer);
      this.persistenceTimer = null;
    }
    this.persistenceFilePath = null;
  }
}
