import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  Clock,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  Flame,
  AlertTriangle,
  Sparkles,
  Trophy,
  Target,
  Award,
  Check,
  BrainCircuit,
  MessageSquare,
  RefreshCw,
  ArrowRight,
  ArrowDownRight,
  ArrowUpRight,
  Minus,
} from 'lucide-react';
import { WeeklyMetrics, PriorityTopicSuggestion } from '../types';
import { GraphEngine } from '../services/graphEngine';
import { StorageService } from '../services/storage';
import { apiFetch } from '../lib/api';
import {
  buildDailyGoals,
  buildMilestones,
  buildWeeklyTrend,
  DailyTrendPoint,
  hasRecordedNodeEvidence,
} from '../services/progressMetrics';
import { MisconceptionsDictionary } from './MisconceptionsDictionary';
import { ConversationHistorySection } from './ConversationHistorySection';
import { WeeklyLanguageDistributionChart } from './WeeklyLanguageDistributionChart';
import { LanguageThemeId } from '../services/languageThemes';

interface WeeklyDashboardProps {
  onStartReview: (topic: string) => void;
  onNavigateToChatWithConversation?: (conversationId: string, topic?: string) => void;
  onSelectLanguage?: (languageName: string, themeId: LanguageThemeId) => void;
}

const getDeltaVisual = (delta?: number) => {
  if (delta && delta > 0) return { Icon: ArrowUpRight, className: 'text-[var(--ok)]' };
  if (delta && delta < 0) return { Icon: ArrowDownRight, className: 'text-rose-600 dark:text-rose-400' };
  return { Icon: Minus, className: 'text-[var(--muted)]' };
};

export const WeeklyDashboard: React.FC<WeeklyDashboardProps> = ({
  onStartReview,
  onNavigateToChatWithConversation,
  onSelectLanguage,
}) => {
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null);
  const [priorityTopics, setPriorityTopics] = useState<PriorityTopicSuggestion[]>([]);
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const [isLoadingPriority, setIsLoadingPriority] = useState(false);

  const loadMetrics = async () => {
    const computed = GraphEngine.calculateWeeklyMetrics();
    setMetrics(computed);

    const localPriorities = GraphEngine.getPriorityTopicsFromMemoryGraph(3);
    setPriorityTopics(localPriorities);

    try {
      const nodes = StorageService.getNodes();
      const corrections = StorageService.getCorrections();
      if (nodes && nodes.length > 0) {
        setIsLoadingPriority(true);
        const res = await apiFetch('/api/dashboard/priority-topics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nos_grafo: nodes.slice(0, 15),
            correcoes: corrections.slice(0, 10),
            metricas: computed,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.prioridades && Array.isArray(data.prioridades) && data.prioridades.length > 0) {
            setPriorityTopics(data.prioridades.slice(0, 3));
          }
        }
      }
    } catch (err) {
      console.warn('Usando tópicos prioritários locais do grafo:', err);
    } finally {
      setIsLoadingPriority(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const progressInput = useMemo(() => {
    const stats = StorageService.getStats();
    const nodes = StorageService.getNodes();
    const corrections = StorageService.getCorrections();
    const sessions = StorageService.getSessions();

    return { stats, nodes, corrections, sessions };
  }, [metrics]);
  const dailyGoals = buildDailyGoals(progressInput);
  const milestones = buildMilestones(progressInput);
  const weeklyGrowthData: DailyTrendPoint[] = useMemo(
    () => buildWeeklyTrend({
      stats: StorageService.getStats(),
      nodes: StorageService.getNodes(),
      corrections: StorageService.getCorrections(),
      sessions: StorageService.getSessions(),
    }),
    [metrics]
  );

  const handleRefreshAIRecommendation = async () => {
    if (!metrics) return;
    setIsLoadingRec(true);

    try {
      const res = await apiFetch('/api/recommendation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicos_dificeis: metrics.topicos_dificeis,
          taxa_acerto: metrics.taxa_acerto,
          minutos_estudados: metrics.minutos_estudados,
          erros_recorrentes: metrics.erros_recorrentes,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMetrics({
          ...metrics,
          recomendacao_objetiva: data.recomendacao,
        });
      }
    } catch (err) {
      console.error('Erro ao gerar recomendação:', err);
    } finally {
      setIsLoadingRec(false);
    }
  };

  if (!metrics) {
    return (
      <div className="text-center py-12 text-[var(--muted)] font-mono text-sm">
        Carregando métricas da semana...
      </div>
    );
  }

  const minutesDelta = metrics.comparativo_semana_anterior.minutos_delta_pct;
  const accuracyDelta = metrics.comparativo_semana_anterior.taxa_acerto_delta_pct;
  const hasRecordedActivity =
    metrics.sessoes_realizadas > 0 ||
    metrics.total_respostas > 0 ||
    metrics.minutos_estudados > 0 ||
    StorageService.getNodes().some((node) => hasRecordedNodeEvidence(node));

  const metricCardsData = [
    {
      id: 'metric-tempo',
      label: 'Tempo',
      icon: Clock,
      value: `${metrics.minutos_estudados}`,
      unit: 'min',
      badge: `${minutesDelta > 0 ? '+' : ''}${minutesDelta}% vs. semana anterior`,
      delta: minutesDelta,
    },
    {
      id: 'metric-precisao',
      label: 'Precisão',
      icon: CheckCircle2,
      value: `${metrics.taxa_acerto}%`,
      badge: `${accuracyDelta > 0 ? '+' : ''}${accuracyDelta}% vs. semana anterior`,
      delta: accuracyDelta,
    },
    {
      id: 'metric-correcoes',
      label: 'Correções',
      icon: TrendingUp,
      value: `${metrics.erros_corrigidos}`,
      unit: `/ ${metrics.erros_recorrentes}`,
      subtext: 'superados vs rec.',
    },
    {
      id: 'metric-sessoes',
      label: 'Sessões',
      icon: BookOpen,
      value: `${metrics.sessoes_realizadas}`,
      unit: 'feitas',
      subtext: metrics.sessoes_realizadas > 0 ? 'registradas no período' : 'nenhuma registrada',
    },
    {
      id: 'metric-habito',
      label: 'Hábito',
      icon: Flame,
      value: `${metrics.sequencia_atual}`,
      unit: 'dias',
      subtext: metrics.sequencia_atual > 0 ? 'sequência atual' : 'comece hoje',
    },
    {
      id: 'metric-revisoes',
      label: 'Revisões',
      icon: AlertTriangle,
      value: `${metrics.revisoes_pendentes}`,
      unit: 'pend.',
      actionText: 'Revisar',
      onAction: () => onStartReview('Revisão Geral'),
    },
  ];

  return (
    <div className="w-full space-y-8 animate-fade-in text-left">
      {/* Cabeçalho */}
      <section className="relative view-card p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-full px-3 py-0.5 text-xs font-extrabold text-[var(--fg)] shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>PROGRESS & ANALYTICS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-[var(--fg)] tracking-tight">
            Painel Semanal de Aprendizagem
          </h1>
          <p className="text-xs sm:text-sm text-[var(--muted)]">
            Ciclo de {metrics.periodo.inicio} até {metrics.periodo.fim} · Progresso e retenção orientados por evidências empíricas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadMetrics}
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)] transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar</span>
          </button>
        </div>
      </section>

      {!hasRecordedActivity && (
        <section className="view-card p-6 text-left space-y-2">
          <h2 className="font-display font-bold text-lg text-[var(--fg)]">
            Seu painel começa com a primeira prática
          </h2>
          <p className="text-sm text-[var(--muted)]">
            Ainda não há sessões, respostas ou termos registrados. Conclua uma atividade para acompanhar sua evolução aqui.
          </p>
        </section>
      )}

      {/* Grid de Métricas Principais (6 Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {metricCardsData.map((m) => {
          const IconComp = m.icon;
          const deltaVisual = getDeltaVisual(m.delta);
          const DeltaIcon = deltaVisual.Icon;
          return (
            <div
              key={m.id}
              className="view-card-subtle p-4 flex flex-col justify-between shadow-xs hover:-translate-y-0.5 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between text-[var(--muted)] mb-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wide">
                  {m.label}
                </span>
                <IconComp className="w-4 h-4 text-[var(--fg)]" />
              </div>

              <div className="my-1.5">
                <span className="font-display font-bold text-2xl sm:text-3xl text-[var(--fg)] leading-none">
                  {m.value}
                </span>
                {m.unit && (
                  <span className="text-xs text-[var(--muted)] font-mono ml-1">
                    {m.unit}
                  </span>
                )}
              </div>

              {m.badge ? (
                <div className={`flex items-center text-[10px] font-extrabold ${deltaVisual.className}`}>
                  <DeltaIcon className="w-3 h-3 mr-0.5" />
                  <span>{m.badge}</span>
                </div>
              ) : m.actionText ? (
                <button
                  onClick={m.onAction}
                  className="text-[11px] font-extrabold text-[var(--accent-deep)] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{m.actionText}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ) : (
                <span className="text-[11px] text-[var(--muted)]">{m.subtext}</span>
              )}
            </div>
          );
        })}
      </section>

      {/* Visualização de Tendência: Consistência Semanal & Crescimento de Vocabulário */}
      <section className="view-card p-6 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--accent-deep)]" />
              <h3 className="text-base sm:text-lg font-display font-bold text-[var(--fg)]">
                Consistência Semanal & Crescimento de Vocabulário
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Evolução diária de tempo de prática (minutos) e curva acumulada de novos termos/estruturas assimiladas.
            </p>
          </div>

          <div className="flex items-center gap-3.5 text-xs">
            <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
              <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
              <span>Tempo de Estudo (min)</span>
            </div>
            <div className="flex items-center gap-1.5 font-bold text-[var(--fg)]">
              <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
              <span>Vocabulário no Grafo</span>
            </div>
          </div>
        </div>

        {hasRecordedActivity ? (
          <div className="w-full h-60 sm:h-64 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={weeklyGrowthData}
                margin={{ top: 10, right: 15, left: -15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0, 0, 0, 0.06)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(0, 0, 0, 0.1)' }}
                />
                <YAxis
                  yAxisId="left"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val}m`}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `${val} un`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    fontSize: '12px',
                    padding: '10px 14px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                  }}
                  labelStyle={{ fontWeight: 'bold', color: '#cbd5e1', marginBottom: '4px' }}
                  formatter={(value: any, name: any) => {
                    if (name === 'minutos') return [`${value} min`, 'Tempo de Estudo'];
                    if (name === 'vocabulario') return [`${value} termos`, 'Vocabulário Ativo'];
                    return [value, name];
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="minutos"
                  name="minutos"
                  stroke="#059669"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, stroke: '#059669', strokeWidth: 2, fill: '#ffffff' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="vocabulario"
                  name="vocabulario"
                  stroke="#d97706"
                  strokeWidth={2.5}
                  strokeDasharray="4 2"
                  dot={{ r: 4, fill: '#d97706', strokeWidth: 2, stroke: '#ffffff' }}
                  activeDot={{ r: 6, stroke: '#d97706', strokeWidth: 2, fill: '#ffffff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-12 text-center text-sm text-[var(--muted)]">
            A tendência aparecerá após sua primeira atividade registrada.
          </p>
        )}

        {/* Rodapé informativo com métricas resumidas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-[var(--border)]">
          <div className="bg-[oklch(0.97_0.01_84)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--muted)]">Tempo Total na Semana</span>
              <p className="text-sm font-bold text-[var(--fg)] font-mono">{metrics.minutos_estudados} min</p>
            </div>
            <Clock className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="bg-[oklch(0.97_0.01_84)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--muted)]">Vocabulário no Grafo</span>
              <p className="text-sm font-bold text-[var(--fg)] font-mono">
                {weeklyGrowthData.at(-1)?.vocabulario ?? 0} termos
              </p>
            </div>
            <BookOpen className="w-4 h-4 text-amber-600" />
          </div>

          <div className="bg-[oklch(0.97_0.01_84)] rounded-xl p-3 border border-[var(--border)] flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-[var(--muted)]">Constância de Hábito</span>
              <p className="text-sm font-bold text-[var(--fg)] font-mono">{metrics.sequencia_atual} dias seguidos</p>
            </div>
            <Flame className="w-4 h-4 text-rose-600" />
          </div>
        </div>
      </section>

      {/* Gráfico de Barras Recharts: Frequência de Conversação & Tempo por Idioma */}
      <WeeklyLanguageDistributionChart
        onSelectLanguage={onSelectLanguage}
        onNavigateToChat={(topic) => onStartReview(topic || 'Conversação Geral')}
      />

      {/* Metas Diárias & Marcos Semanais */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Metas Diárias */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-[var(--fg)] flex items-center gap-2">
              <Target className="w-4 h-4 text-[var(--accent-deep)]" />
              <span>Metas Diárias de Aprendizagem</span>
            </h3>
            <span className="text-xs font-bold text-[var(--muted)]">
              {dailyGoals.filter((g) => g.concluida).length}/{dailyGoals.length} concluídas
            </span>
          </div>

          <div className="space-y-3">
            {dailyGoals.map((goal) => {
              const isAchieved = goal.concluida;
              const pct = Math.min(100, Math.round((goal.progresso_atual / goal.meta_total) * 100));

              return (
                <div
                  key={goal.id}
                  className={`view-card-subtle p-4 sm:p-5 transition ${
                    isAchieved
                      ? 'border-[var(--ok)] bg-[var(--mint)] shadow-xs'
                      : 'border-[var(--border)] hover:border-[var(--fg)]/40 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        aria-hidden="true"
                        className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center border ${
                          isAchieved
                            ? 'bg-[var(--ok)] text-white border-[var(--ok)] shadow-xs'
                            : 'border-[var(--border)] text-transparent bg-white'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                      <span className="sr-only">
                        {isAchieved ? 'Meta concluída' : 'Meta em andamento'}
                      </span>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4
                            className={`text-sm font-bold text-[var(--fg)] ${
                              isAchieved ? 'line-through opacity-70' : ''
                            }`}
                          >
                            {goal.titulo}
                          </h4>
                          <span className="text-[10px] font-extrabold text-[var(--accent-deep)] px-2 py-0.2 rounded-full bg-[var(--accent-soft)]">
                            +{goal.xp_recompensa} XP
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {goal.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono font-bold text-[var(--fg)]">
                        {goal.progresso_atual}/{goal.meta_total}
                      </span>
                      <span className="text-[10px] text-[var(--muted)] ml-1">
                        {goal.unidade}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 w-full bg-[oklch(0.92_0.02_84)] rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isAchieved ? 'bg-[var(--ok)]' : 'bg-[var(--accent)]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Marcos Semanais */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-lg text-[var(--fg)] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-600" />
              <span>Marcos & Conquistas da Semana</span>
            </h3>
            <span className="text-xs font-bold text-[var(--muted)]">Habilidades chave</span>
          </div>

          <div className="space-y-3">
            {milestones.map((ms) => {
              const isUnlocked = ms.concluida;
              const pct = Math.min(100, Math.round((ms.progresso_atual / ms.meta_total) * 100));

              return (
                <div
                  key={ms.id}
                  className={`view-card-subtle p-4 sm:p-5 transition ${
                    isUnlocked
                      ? 'border-[var(--ok)] bg-[var(--mint)] shadow-xs'
                      : 'border-[var(--border)] hover:border-[var(--fg)]/40 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isUnlocked
                            ? 'bg-[var(--sunny)] text-[var(--fg)]'
                            : 'bg-[oklch(0.94_0.01_84)] text-[var(--muted)]'
                        }`}
                      >
                        <Award className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[var(--fg)]">
                            {ms.titulo}
                          </h4>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]">
                            {ms.nivel}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted)] mt-0.5">
                          {ms.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isUnlocked ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-[var(--ok)] text-white">
                          <Sparkles className="w-3 h-3" />
                          Conquistado
                        </span>
                      ) : (
                        <span className="text-xs px-3 py-1 font-extrabold rounded-full border border-[var(--border)] bg-[var(--surface)]">
                          Em andamento
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs text-[var(--muted)] mb-1">
                    <span>Progresso do marco:</span>
                    <span className="font-bold text-[var(--fg)] font-mono">
                      {ms.progresso_atual}/{ms.meta_total} {ms.unidade}
                    </span>
                  </div>
                  <div className="w-full bg-[oklch(0.92_0.02_84)] rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--ok)] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Diretriz Pedagógica da IA */}
      <section className="view-card p-6 sm:p-7 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold bg-[var(--accent-soft)] text-[var(--accent-deep)] px-2.5 py-1 rounded-full border border-[var(--accent-deep)]/20">
              AI PEDAGOGICAL INSIGHT
            </span>
            <h3 className="text-sm sm:text-base font-display font-bold text-[var(--fg)]">
              Diretriz Estratégica para o Próximo Ciclo
            </h3>
          </div>

          <button
            onClick={handleRefreshAIRecommendation}
            disabled={isLoadingRec}
            className="text-xs font-bold text-[var(--muted)] hover:text-[var(--fg)] flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRec ? 'animate-spin' : ''}`} />
            <span>{isLoadingRec ? 'Analisando...' : 'Reanalisar'}</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[var(--fg)] leading-relaxed">
          {metrics.recomendacao_objetiva}
        </p>
      </section>

      {/* 3 Tópicos Prioritários Sugeridos pelo Grafo */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-[var(--fg)]" />
              <h3 className="text-base font-display font-bold text-[var(--fg)]">
                3 Tópicos Prioritários Sugeridos pelo Grafo de Memória
              </h3>
            </div>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              Identificados automaticamente pela topologia do grafo (taxa de erro, dependências e retenção).
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {priorityTopics.map((topic, idx) => (
            <div
              key={topic.id || idx}
              className="view-card-subtle p-5.5 flex flex-col justify-between space-y-3 hover:shadow-md transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-[var(--muted)]">
                    #{idx + 1} Prioridade
                  </span>
                  <span
                    className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                      topic.nivel_urgencia === 'critica'
                        ? 'bg-rose-100 text-rose-800'
                        : topic.nivel_urgencia === 'alta'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-[oklch(0.94_0.01_84)] text-[var(--fg)]'
                    }`}
                  >
                    Urgência {topic.nivel_urgencia}
                  </span>
                </div>

                <h4 className="text-sm font-display font-bold text-[var(--fg)]">
                  {topic.titulo}
                </h4>

                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {topic.motivo_prioridade}
                </p>

                <div className="bg-[oklch(0.97_0.01_84)] p-2.5 rounded-xl border border-[var(--border)] space-y-1 text-xs">
                  <div className="flex justify-between text-[var(--muted)]">
                    <span>Domínio no grafo:</span>
                    <span className="font-bold text-[var(--fg)]">{topic.dominio_atual}%</span>
                  </div>
                  <div className="w-full bg-[oklch(0.92_0.02_84)] rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        topic.dominio_atual >= 70
                          ? 'bg-[var(--ok)]'
                          : topic.dominio_atual >= 40
                          ? 'bg-amber-500'
                          : 'bg-[var(--bad)]'
                      }`}
                      style={{ width: `${topic.dominio_atual}%` }}
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => onStartReview(topic.titulo)}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-extrabold text-xs bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-xs cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Focar no Chat Agora</span>
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Histórico das Últimas Sessões de Conversação */}
      <ConversationHistorySection
        limit={5}
        onSelectConversation={(convId, topic) => {
          if (onNavigateToChatWithConversation) {
            onNavigateToChatWithConversation(convId, topic);
          } else {
            StorageService.setActiveConversationId(convId);
            onStartReview(topic || 'Conversação');
          }
        }}
        onNewConversation={() => onStartReview('Conversação Geral')}
      />

      {/* Dicionário de Equívocos Recorrentes */}
      <MisconceptionsDictionary onPracticeTopic={onStartReview} />
    </div>
  );
};
