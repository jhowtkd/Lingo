import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sparkles,
  RefreshCw,
  ArrowUpRight,
  BookOpen,
  ArrowRight,
  Trophy,
  Target,
  Award,
  Zap,
  Check,
  Star,
  Layers,
  BrainCircuit,
  MessageSquare,
  HelpCircle,
} from 'lucide-react';
import { WeeklyMetrics, DailyGoal, MilestoneItem, PriorityTopicSuggestion } from '../types';
import { GraphEngine } from '../services/graphEngine';
import { StorageService } from '../services/storage';
import { MisconceptionsDictionary } from './MisconceptionsDictionary';
import { SectionHeader } from './ui/section-header';
import { CornerPlus } from './ui/corner-plus';
import { BorderTrail } from './ui/border-trail';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface WeeklyDashboardProps {
  onStartReview: (topic: string) => void;
}

export const WeeklyDashboard: React.FC<WeeklyDashboardProps> = ({ onStartReview }) => {
  const [metrics, setMetrics] = useState<WeeklyMetrics | null>(null);
  const [priorityTopics, setPriorityTopics] = useState<PriorityTopicSuggestion[]>([]);
  const [isLoadingRec, setIsLoadingRec] = useState(false);
  const [isLoadingPriority, setIsLoadingPriority] = useState(false);

  // Metas Diárias com Estado Interativo
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>([
    {
      id: 'goal-1',
      titulo: 'Estudo Diário de Conversação',
      descricao: 'Praticar pronúncia e fluência com o tutor AI',
      categoria: 'tempo',
      progresso_atual: 15,
      meta_total: 20,
      unidade: 'min',
      concluida: false,
      xp_recompensa: 50,
      icone: 'clock',
    },
    {
      id: 'goal-2',
      titulo: 'Acurácia de Conversação ≥ 80%',
      descricao: 'Manter respostas gramaticalmente corretas no diálogo',
      categoria: 'precisao',
      progresso_atual: 82,
      meta_total: 80,
      unidade: '%',
      concluida: true,
      xp_recompensa: 75,
      icone: 'target',
    },
    {
      id: 'goal-3',
      titulo: 'Revisão Espaçada Ativa',
      descricao: 'Completar flashcards e conceitos com revisão pendente',
      categoria: 'revisao',
      progresso_atual: 4,
      meta_total: 5,
      unidade: 'cards',
      concluida: false,
      xp_recompensa: 40,
      icone: 'zap',
    },
  ]);

  // Marcos de Aprendizagem (Milestones)
  const [milestones, setMilestones] = useState<MilestoneItem[]>([
    {
      id: 'ms-1',
      titulo: 'Guardião da Constância',
      descricao: 'Mantenha 5 dias consecutivos de prática ativa na semana',
      nivel: 'Ouro',
      progresso_atual: 5,
      meta_total: 5,
      unidade: 'dias',
      concluida: true,
      xp_recompensa: 200,
      data_conquista: 'Hoje',
      categoria: 'streak',
    },
    {
      id: 'ms-2',
      titulo: 'Mestre da Topologia SRS',
      descricao: 'Alcance mais de 80% de domínio em 6 nós no grafo de memória',
      nivel: 'Prata',
      progresso_atual: 5,
      meta_total: 6,
      unidade: 'nós',
      concluida: false,
      xp_recompensa: 150,
      categoria: 'mastery',
    },
    {
      id: 'ms-3',
      titulo: 'Superador de Falsos Amigos',
      descricao: 'Corrija e valide 3 equívocos conceituais ou falsos cognatos',
      nivel: 'Bronze',
      progresso_atual: 2,
      meta_total: 3,
      unidade: 'erros',
      concluida: false,
      xp_recompensa: 100,
      categoria: 'accuracy',
    },
  ]);

  // Identificadores de cards que estão atualmente com o pulso ativo (scale-up + BorderTrail)
  const [pulsingCardIds, setPulsingCardIds] = useState<Set<string>>(new Set(['ms-1', 'goal-2']));
  const [recentlyAchievedId, setRecentlyAchievedId] = useState<string | null>(null);

  const loadMetrics = async () => {
    const computed = GraphEngine.calculateWeeklyMetrics();
    setMetrics(computed);

    // Carrega os 3 tópicos prioritários imediatos do motor de grafo
    const localPriorities = GraphEngine.getPriorityTopicsFromMemoryGraph(3);
    setPriorityTopics(localPriorities);

    // Tenta enriquecer com IA assíncrona se disponível
    try {
      const nodes = StorageService.getNodes();
      const corrections = StorageService.getCorrections();
      if (nodes && nodes.length > 0) {
        setIsLoadingPriority(true);
        const res = await fetch('/api/dashboard/priority-topics', {
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

  // Disparo de celebração e ativação da animação de escala + BorderTrail
  const triggerMilestoneCelebration = (id: string) => {
    setRecentlyAchievedId(id);
    setPulsingCardIds((prev) => new Set([...prev, id]));

    try {
      confetti({
        particleCount: 45,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#000000', '#ffffff', '#eab308', '#10b981'],
        ticks: 150,
      });
    } catch {
      // Confetti fallback
    }

    setTimeout(() => {
      setRecentlyAchievedId((current) => (current === id ? null : current));
    }, 4000);
  };

  // Alterna o status de conclusão de uma Meta Diária com animação
  const handleToggleDailyGoal = (goalId: string) => {
    setDailyGoals((prev) =>
      prev.map((g) => {
        if (g.id === goalId) {
          const nextConcluida = !g.concluida;
          if (nextConcluida) {
            triggerMilestoneCelebration(g.id);
            return {
              ...g,
              concluida: true,
              progresso_atual: g.meta_total,
            };
          } else {
            setPulsingCardIds((p) => {
              const next = new Set(p);
              next.delete(g.id);
              return next;
            });
            return {
              ...g,
              concluida: false,
              progresso_atual: Math.max(0, g.meta_total - 2),
            };
          }
        }
        return g;
      })
    );
  };

  // Concluir ou Simular Conquista de um Marco
  const handleCompleteMilestone = (msId: string) => {
    setMilestones((prev) =>
      prev.map((ms) => {
        if (ms.id === msId) {
          triggerMilestoneCelebration(ms.id);
          return {
            ...ms,
            concluida: true,
            progresso_atual: ms.meta_total,
            data_conquista: 'Agora mesmo',
          };
        }
        return ms;
      })
    );
  };

  // Simular Conquista Rápida para demonstração da animação
  const handleSimulateNewMilestone = () => {
    const uncompleted = milestones.find((m) => !m.concluida) || dailyGoals.find((g) => !g.concluida);
    if (uncompleted) {
      if ('nivel' in uncompleted) {
        handleCompleteMilestone(uncompleted.id);
      } else {
        handleToggleDailyGoal(uncompleted.id);
      }
    } else {
      // Re-ativa o pulso em um marco existente
      const pick = milestones[0];
      triggerMilestoneCelebration(pick.id);
    }
  };

  const handleRefreshAIRecommendation = async () => {
    if (!metrics) return;
    setIsLoadingRec(true);

    try {
      const res = await fetch('/api/recommendation', {
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
      <div className="text-center py-12 text-muted-foreground font-mono text-sm">
        Carregando métricas semanais...
      </div>
    );
  }

  // Métricas para cards do topo
  const metricCardsData = [
    {
      id: 'metric-tempo',
      label: 'TEMPO',
      icon: Clock,
      value: `${metrics.minutos_estudados}`,
      unit: 'min',
      badge: `+${metrics.comparativo_semana_anterior.minutos_delta_pct}% semana`,
      badgeColor: 'text-emerald-600 dark:text-emerald-400',
      isMilestone: metrics.minutos_estudados >= 60,
    },
    {
      id: 'metric-precisao',
      label: 'PRECISÃO',
      icon: CheckCircle2,
      value: `${metrics.taxa_acerto}%`,
      badge: `+${metrics.comparativo_semana_anterior.taxa_acerto_delta_pct}% precisão`,
      badgeColor: 'text-emerald-600 dark:text-emerald-400',
      isMilestone: metrics.taxa_acerto >= 80,
    },
    {
      id: 'metric-correcoes',
      label: 'CORREÇÕES',
      icon: TrendingUp,
      value: `${metrics.erros_corrigidos}`,
      unit: `/ ${metrics.erros_recorrentes}`,
      subtext: 'superados vs rec.',
      isMilestone: metrics.erros_corrigidos >= 5,
    },
    {
      id: 'metric-sessoes',
      label: 'SESSÕES',
      icon: BookOpen,
      value: `${metrics.sessoes_realizadas}`,
      unit: 'feitas',
      subtext: 'ritmo constante',
      isMilestone: metrics.sessoes_realizadas >= 4,
    },
    {
      id: 'metric-habito',
      label: 'HÁBITO',
      icon: Flame,
      iconColor: 'text-amber-500 fill-amber-500',
      value: `${metrics.sequencia_atual}`,
      unit: 'dias',
      subtext: 'Meta batida',
      isMilestone: metrics.sequencia_atual >= 3,
    },
    {
      id: 'metric-revisoes',
      label: 'REVISÕES',
      icon: AlertTriangle,
      value: `${metrics.revisoes_pendentes}`,
      unit: 'pend.',
      actionText: 'Revisar',
      onAction: () => onStartReview('Revisão Geral'),
      isMilestone: metrics.revisoes_pendentes === 0,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative border border-[#171719]/10 bg-white p-6 sm:p-8 rounded-[25px] shadow-sm"
      >
        <CornerPlus />
        <SectionHeader
          tag="PROGRESS ANALYTICS & REWARD ENGINE"
          title="Painel Semanal de Aprendizagem"
          description={`Ciclo de ${metrics.periodo.inicio} até ${metrics.periodo.fim} • Progresso e retenção orientados por evidências empíricas com celebração de metas.`}
          action={
            <div className="flex items-center gap-2">
              <Button
                variant="accent"
                size="sm"
                onClick={handleSimulateNewMilestone}
                className="gap-1.5 font-bold text-xs cursor-pointer rounded-[9px]"
                title="Dispara a animação de escala e o pulso BorderTrail em uma meta/marco"
              >
                <Trophy className="w-3.5 h-3.5 text-[#171719]" />
                <span>SIMULAR META</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadMetrics}
                className="gap-1.5 font-bold text-xs cursor-pointer rounded-[9px]"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ATUALIZAR</span>
              </Button>
            </div>
          }
        />
      </motion.div>

      {/* Grid de Métricas Principais (6 Cards) com Animação Framer Motion e BorderTrail */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCardsData.map((m, idx) => {
          const IconComp = m.icon;
          const isPulsing = pulsingCardIds.has(m.id) || (m.isMilestone && recentlyAchievedId === m.id);

          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{
                opacity: 1,
                y: 0,
                scale: isPulsing ? [1, 1.05, 1] : 1,
              }}
              whileHover={{ y: -3, scale: 1.02 }}
              transition={{
                duration: 0.3,
                delay: idx * 0.05,
                scale: {
                  type: 'spring',
                  stiffness: 300,
                  damping: 15,
                },
              }}
              onClick={() => {
                if (m.isMilestone) {
                  triggerMilestoneCelebration(m.id);
                }
              }}
              className={`relative border bg-white rounded-[20px] p-4 flex flex-col justify-between shadow-xs transition-all select-none font-mono ${
                isPulsing
                  ? 'border-[#08ba61] shadow-md ring-2 ring-[#1ff98c]'
                  : 'border-[#171719]/10 hover:border-[#171719]/30'
              } ${isPulsing ? 'overflow-hidden' : ''}`}
            >
              <CornerPlus size="size-2.5" />

              {/* PULSO BORDERTRAIL QUANDO ATINGE MARCO */}
              {isPulsing && (
                <BorderTrail
                  size={70}
                  transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                  style={{
                    boxShadow:
                      '0px 0px 40px 20px rgba(31, 249, 140, 0.5), 0 0 70px 35px rgba(8, 186, 97, 0.4)',
                  }}
                />
              )}

              <div className="flex items-center justify-between text-[#71717a]">
                <IconComp className={`w-4 h-4 ${m.iconColor || 'text-[#171719]'}`} />
                <div className="flex items-center space-x-1">
                  {m.isMilestone && (
                    <Sparkles className="w-2.5 h-2.5 text-[#08ba61] animate-pulse" />
                  )}
                  <span className="text-[10px] uppercase font-bold text-[#71717a]">
                    {m.label}
                  </span>
                </div>
              </div>

              <div className="my-2.5">
                <span className="font-extrabold tracking-tighter text-3xl text-[#171719]">
                  {m.value}
                </span>
                {m.unit && (
                  <span className="text-xs text-[#71717a] font-mono ml-1">
                    {m.unit}
                  </span>
                )}
              </div>

              {m.badge ? (
                <div className="flex items-center text-[10px] font-bold text-[#08ba61]">
                  <ArrowUpRight className="w-3 h-3 mr-0.5" />
                  <span>{m.badge}</span>
                </div>
              ) : m.actionText ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    m.onAction?.();
                  }}
                  className="text-[10px] font-bold text-[#171719] hover:text-[#08ba61] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{m.actionText}</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              ) : (
                <span className="text-[10px] text-[#71717a]">{m.subtext}</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* SEÇÃO INTERATIVA: Metas Diárias & Marcos de Aprendizagem com Framer Motion e BorderTrail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel de Metas Diárias (Daily Goals) */}
        <div className="lg:col-span-6 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-foreground" />
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Metas Diárias de Aprendizagem
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">
              {dailyGoals.filter((g) => g.concluida).length}/{dailyGoals.length} CONCLUÍDAS
            </span>
          </div>

          <div className="space-y-3">
            {dailyGoals.map((goal, idx) => {
              const isAchieved = goal.concluida;
              const isPulsing = pulsingCardIds.has(goal.id) || recentlyAchievedId === goal.id;
              const pct = Math.min(100, Math.round((goal.progresso_atual / goal.meta_total) * 100));

              return (
                <motion.div
                  key={goal.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: isPulsing ? [1, 1.04, 1] : 1,
                  }}
                  whileHover={{ y: -2 }}
                  transition={{
                    duration: 0.3,
                    delay: idx * 0.08,
                    scale: {
                      type: 'spring',
                      stiffness: 350,
                      damping: 16,
                    },
                  }}
                  className={`relative border bg-white rounded-[20px] p-4 sm:p-5 shadow-xs transition-all ${
                    isAchieved
                      ? 'border-[#08ba61] bg-[#1ff98c]/5'
                      : 'border-[#171719]/10 hover:border-[#171719]/25'
                  } ${isPulsing ? 'overflow-hidden ring-2 ring-[#1ff98c] shadow-md' : ''}`}
                >
                  <CornerPlus size="size-2.5" />

                  {/* BORDERTRAIL ANIMADO NA META CONCLUÍDA / ATIVA */}
                  {isPulsing && (
                    <BorderTrail
                      size={90}
                      transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                      style={{
                        boxShadow:
                          '0px 0px 45px 22px rgba(31, 249, 140, 0.5), 0 0 75px 35px rgba(8, 186, 97, 0.4)',
                      }}
                    />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <button
                        onClick={() => handleToggleDailyGoal(goal.id)}
                        className={`mt-0.5 w-5 h-5 rounded-[6px] flex items-center justify-center border transition cursor-pointer ${
                          isAchieved
                            ? 'bg-[#08ba61] text-white border-[#08ba61] font-bold shadow-xs'
                            : 'border-[#171719]/30 hover:border-[#08ba61] text-transparent bg-white'
                        }`}
                        title={isAchieved ? 'Marcar como pendente' : 'Concluir meta'}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4
                            className={`text-xs font-bold tracking-tight transition ${
                              isAchieved
                                ? 'text-[#171719] line-through decoration-[#71717a]'
                                : 'text-[#171719]'
                            }`}
                          >
                            {goal.titulo}
                          </h4>
                          <span className="text-[10px] font-bold text-[#08ba61] px-1.5 py-0.2 rounded-full bg-[#1ff98c]/20 border border-[#08ba61]/20">
                            +{goal.xp_recompensa} XP
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71717a] mt-0.5">
                          {goal.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-extrabold text-[#171719]">
                        {goal.progresso_atual}/{goal.meta_total}
                      </span>
                      <span className="text-[10px] text-[#71717a] ml-1">
                        {goal.unidade}
                      </span>
                    </div>
                  </div>

                  {/* Barra de Progresso Animada */}
                  <div className="mt-3 w-full bg-[#ededed] rounded-full h-1.5 overflow-hidden border border-[#171719]/10">
                    <motion.div
                      className={`h-full rounded-full ${
                        isAchieved ? 'bg-[#08ba61]' : 'bg-[#171719]'
                      }`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Painel de Marcos Semanais (Learning Milestones) */}
        <div className="lg:col-span-6 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold tracking-tight text-foreground">
                Marcos & Conquistas da Semana
              </h3>
            </div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">
              HABILIDADES CHAVE
            </span>
          </div>

          <div className="space-y-3">
            {milestones.map((ms, idx) => {
              const isUnlocked = ms.concluida;
              const isPulsing = pulsingCardIds.has(ms.id) || recentlyAchievedId === ms.id;
              const pct = Math.min(100, Math.round((ms.progresso_atual / ms.meta_total) * 100));

              return (
                <motion.div
                  key={ms.id}
                  layout
                  initial={{ opacity: 0, x: 10 }}
                  animate={{
                    opacity: 1,
                    x: 0,
                    scale: isPulsing ? [1, 1.04, 1] : 1,
                  }}
                  whileHover={{ y: -2 }}
                  transition={{
                    duration: 0.3,
                    delay: idx * 0.08,
                    scale: {
                      type: 'spring',
                      stiffness: 350,
                      damping: 16,
                    },
                  }}
                  className={`relative border bg-white rounded-[20px] p-4 sm:p-5 shadow-xs transition-all ${
                    isUnlocked
                      ? 'border-[#08ba61] bg-[#1ff98c]/5'
                      : 'border-[#171719]/10 hover:border-[#171719]/25'
                  } ${isPulsing ? 'overflow-hidden ring-2 ring-[#1ff98c] shadow-md' : ''}`}
                >
                  <CornerPlus size="size-2.5" />

                  {/* BORDERTRAIL ANIMADO NO MARCO DESBLOQUEADO */}
                  {isPulsing && (
                    <BorderTrail
                      size={95}
                      transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                      style={{
                        boxShadow:
                          '0px 0px 45px 22px rgba(31, 249, 140, 0.5), 0 0 75px 35px rgba(8, 186, 97, 0.4)',
                      }}
                    />
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div
                        className={`w-8 h-8 rounded-[9px] flex items-center justify-center border shrink-0 ${
                          isUnlocked
                            ? 'bg-[#171719] text-[#1ff98c] border-[#171719]'
                            : 'bg-[#ededed] text-[#71717a] border-[#171719]/10'
                        }`}
                      >
                        <Award className="w-4 h-4" />
                      </div>

                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-[#171719] tracking-tight">
                            {ms.titulo}
                          </h4>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full border ${
                              ms.nivel === 'Ouro'
                                ? 'bg-[#1ff98c]/20 text-[#08ba61] border-[#08ba61]/30'
                                : ms.nivel === 'Prata'
                                ? 'bg-[#ededed] text-[#171719] border-[#171719]/20'
                                : 'bg-[#ededed] text-[#71717a] border-[#171719]/10'
                            }`}
                          >
                            {ms.nivel}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#71717a] mt-0.5">
                          {ms.descricao}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {isUnlocked ? (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-[9px] bg-[#08ba61] text-white">
                            <Sparkles className="w-3 h-3" />
                            CONQUISTADO
                          </span>
                          <span className="text-[9px] text-[#71717a] mt-0.5">
                            {ms.data_conquista || 'Concluído'}
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCompleteMilestone(ms.id)}
                          className="text-[10px] h-6 px-2 font-bold cursor-pointer rounded-[9px]"
                        >
                          Concluir
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso */}
                  <div className="mt-3 flex items-center justify-between text-[10px] text-[#71717a] mb-1">
                    <span>Progresso do Marco:</span>
                    <span className="font-bold text-[#171719]">
                      {ms.progresso_atual}/{ms.meta_total} {ms.unidade}
                    </span>
                  </div>
                  <div className="w-full bg-[#ededed] rounded-full h-1.5 overflow-hidden border border-[#171719]/10">
                    <motion.div
                      className="h-full rounded-full bg-[#08ba61]"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Card da Recomendação Pedagógica Objetiva com BorderTrail */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative border border-[#171719]/10 bg-white rounded-[25px] p-6 sm:p-7 shadow-sm space-y-3 overflow-hidden font-mono"
      >
        <BorderTrail
          size={120}
          transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
          style={{
            boxShadow:
              '0px 0px 50px 25px rgba(31, 249, 140, 0.35), 0 0 80px 40px rgba(8, 186, 97, 0.25)',
          }}
        />
        <CornerPlus />

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center rounded-full border border-[#171719]/15 bg-[#ededed] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#171719] uppercase">
              AI PEDAGOGICAL INSIGHT
            </div>
            <span className="font-extrabold text-sm text-[#171719]">Diretriz Estratégica para o Próximo Ciclo</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefreshAIRecommendation}
            disabled={isLoadingRec}
            className="font-bold text-xs text-[#71717a] hover:text-[#171719] cursor-pointer rounded-[9px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoadingRec ? 'animate-spin' : ''}`} />
            <span>{isLoadingRec ? 'Analisando...' : 'Reanalisar'}</span>
          </Button>
        </div>

        <p className="text-xs sm:text-sm text-[#71717a] leading-relaxed">
          {metrics.recomendacao_objetiva}
        </p>
      </motion.div>

      {/* NOVO: 3 Tópicos Prioritários do Grafo de Memória para a Próxima Sessão de Chat */}
      <div className="space-y-4 font-mono">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <BrainCircuit className="w-4 h-4 text-[#171719]" />
              <h3 className="text-sm font-extrabold tracking-tight text-[#171719] uppercase">
                3 Tópicos Prioritários Sugeridos pelo Grafo de Memória
              </h3>
              <div className="inline-flex items-center rounded-full border border-[#171719]/15 bg-[#1ff98c]/20 px-2 py-0.5 text-[10px] font-bold text-[#08ba61] uppercase">
                NEXT CHAT SESSION
              </div>
            </div>
            <p className="text-xs text-[#71717a] mt-0.5">
              Identificados automaticamente pela topologia do grafo (taxa de erro, dependências conceituais e retenção).
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={loadMetrics}
            disabled={isLoadingPriority}
            className="font-bold text-xs cursor-pointer gap-1.5 rounded-[9px]"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingPriority ? 'animate-spin' : ''}`} />
            <span>{isLoadingPriority ? 'Recalculando...' : 'Atualizar Grafo'}</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {priorityTopics.map((topic, idx) => {
            const urgencyBadgeColor =
              topic.nivel_urgencia === 'critica'
                ? 'border-rose-500/40 bg-rose-500/10 text-rose-600'
                : topic.nivel_urgencia === 'alta'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                : 'border-[#171719]/10 bg-[#ededed] text-[#71717a]';

            return (
              <motion.div
                key={topic.id || idx}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.08 }}
                className="relative border border-[#171719]/10 bg-white rounded-[20px] p-5 shadow-xs space-y-3 flex flex-col justify-between overflow-hidden"
              >
                <CornerPlus size="size-2" />

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-mono text-[10px] font-bold text-[#71717a]">
                      #{idx + 1} PRIORIDADE
                    </span>
                    <span
                      className={`text-[9px] font-mono uppercase font-bold px-2 py-0.5 rounded-full border ${urgencyBadgeColor}`}
                    >
                      Urgência {topic.nivel_urgencia}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-[#171719] tracking-tight">
                      {topic.titulo}
                    </h4>
                    <p className="text-xs text-[#71717a] mt-1 leading-relaxed line-clamp-2">
                      {topic.motivo_prioridade}
                    </p>
                  </div>

                  {/* Nível de Domínio & Frequência de Erro */}
                  <div className="bg-[#ededed] p-2.5 rounded-[9px] border border-[#171719]/10 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center text-[#71717a]">
                      <span>Domínio no Grafo:</span>
                      <span className="font-bold text-[#171719]">{topic.dominio_atual}%</span>
                    </div>
                    <div className="w-full bg-white rounded-full h-1.5 overflow-hidden border border-[#171719]/10">
                      <div
                        className={`h-full rounded-full ${
                          topic.dominio_atual >= 70
                            ? 'bg-[#08ba61]'
                            : topic.dominio_atual >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${topic.dominio_atual}%` }}
                      />
                    </div>
                  </div>

                  {/* Estratégia Sugerida */}
                  <div className="text-[11px] text-[#71717a] space-y-0.5">
                    <span className="font-bold text-[#171719] block text-[10px] uppercase">
                      Estratégia Recomendada:
                    </span>
                    <p className="leading-snug italic text-[#171719]">"{topic.estrategia_sugerida}"</p>
                  </div>

                  {/* Nós Relacionados / Dependências */}
                  {topic.nos_relacionados && topic.nos_relacionados.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {topic.nos_relacionados.slice(0, 3).map((rel, rIdx) => (
                        <span
                          key={rIdx}
                          className="text-[9px] px-2 py-0.5 rounded-[6px] bg-[#ededed] border border-[#171719]/10 text-[#171719] font-bold"
                        >
                          🔗 {rel}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="default"
                  onClick={() => onStartReview(topic.titulo)}
                  className="w-full mt-2 font-bold text-xs cursor-pointer gap-1.5 rounded-[9px]"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-white" />
                  <span>Focar no Chat Agora</span>
                </Button>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Grid: Evolução do Domínio & Tópicos Mais Difíceis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução de Domínio por Tópico */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative border border-border bg-card rounded-lg p-5 shadow-2xs space-y-4 font-mono"
        >
          <CornerPlus />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-foreground" />
              <span>Evolução do Domínio de Aprendizagem</span>
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">SRS PROGRESS</span>
          </div>

          <div className="space-y-4 pt-1">
            {metrics.evolucao_dominio.map((item, idx) => (
              <div key={idx} className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">{item.topico}</span>
                  <div className="flex items-center space-x-2 font-mono">
                    <span className="text-muted-foreground line-through">{item.dominio_inicial}%</span>
                    <span className="font-bold text-foreground">{item.dominio_atual}%</span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      (+{item.dominio_atual - item.dominio_inicial}%)
                    </span>
                  </div>
                </div>

                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden flex border border-border">
                  <div
                    className="bg-muted-foreground/30 h-full"
                    style={{ width: `${item.dominio_inicial}%` }}
                  />
                  <motion.div
                    className="bg-foreground h-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${item.dominio_atual - item.dominio_inicial}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Tópicos com Mais Dificuldades / Erros */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="relative border border-border bg-card rounded-lg p-5 shadow-2xs space-y-4 font-mono"
        >
          <CornerPlus />
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold tracking-tight text-foreground flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-foreground" />
              <span>Pontos de Maior Dificuldade & Equívocos</span>
            </h3>
            <span className="font-mono text-[10px] text-muted-foreground uppercase">NEEDS REINFORCEMENT</span>
          </div>

          <div className="space-y-2.5 pt-1">
            {metrics.topicos_dificeis.map((item, idx) => (
              <div
                key={idx}
                className="bg-muted/40 p-3 rounded-lg border border-border flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="font-bold text-xs text-foreground">{item.topico}</h4>
                  <div className="flex items-center space-x-3 text-[11px] text-muted-foreground mt-1 font-mono">
                    <span>Erros: <strong className="text-foreground">{item.erros}</strong></span>
                    <span>•</span>
                    <span>Domínio: <strong className="text-foreground">{item.dominio_medio}%</strong></span>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onStartReview(item.topico)}
                  className="font-mono text-xs cursor-pointer"
                >
                  Praticar
                </Button>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Dicionário Interativo de Equívocos Recorrentes do Grafo */}
      <MisconceptionsDictionary onPracticeTopic={onStartReview} />
    </div>
  );
};


