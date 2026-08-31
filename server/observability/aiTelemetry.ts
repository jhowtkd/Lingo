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
  historyItems: number;
  memoryItems: number;
  language: string;
  cefrLevel: string;
  status: 'success' | 'degraded' | 'error';
  errorCode?: string;
}

export class AiTelemetry {
  private static logs: TutorTelemetryLog[] = [];
  private static maxLogs = 200;

  static record(log: TutorTelemetryLog): void {
    // Registra métricas agregadas e estruturadas sem vazar dados brutos de mensagens ou PII
    this.logs.unshift(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    const level = log.status === 'error' ? 'warn' : 'info';
    console[level](
      `[AI Telemetry] [${log.route}] req=${log.requestId} lang=${log.language} cefr=${log.cefrLevel} model=${log.modelUsed || log.modelRequested} degraded=${log.degraded} dur=${log.durationMs}ms ttft=${log.timeToFirstChunkMs || '-'}ms status=${log.status}`
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
}
