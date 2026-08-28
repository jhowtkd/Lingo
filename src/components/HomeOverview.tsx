import React from 'react';
import {
  MessageSquare,
  Layers,
  Swords,
  BookOpen,
  AlertCircle,
  Network,
  Trophy,
  BarChart3,
  Flame,
  ArrowRight,
  Play,
  Zap,
} from 'lucide-react';
import { UserStats } from '../types';

interface HomeOverviewProps {
  stats: UserStats;
  currentTopic: string;
  onNavigate: (tab: string) => void;
}

export const HomeOverview: React.FC<HomeOverviewProps> = ({
  stats,
  currentTopic,
  onNavigate,
}) => {
  const goalMinutes = stats.meta_diaria_minutos || 30;
  const currentMinutes = stats.minutos_hoje || 0;
  const progressPercent = Math.min(100, Math.round((currentMinutes / goalMinutes) * 100));

  // Stroke offset math for 120x120 circle with r=50 (perimeter = 2 * PI * 50 = 314.16)
  const circumference = 314.16;
  const strokeDashoffset = circumference - (circumference * progressPercent) / 100;

  const studySpaces = [
    {
      id: 'chat',
      title: 'Conversação',
      description: 'Tutor de fluência com voz ao vivo e treino de pronúncia.',
      icon: MessageSquare,
      bg: 'var(--accent-soft)',
      color: 'var(--accent-deep)',
      action: 'Abrir',
    },
    {
      id: 'flashcards',
      title: 'Flashcards',
      description: 'Repetição espaçada SM-2 com os termos do seu grafo.',
      icon: Layers,
      bg: 'var(--sky)',
      color: 'oklch(0.4 0.08 250)',
      action: 'Revisar',
    },
    {
      id: 'duel',
      title: 'Duelo',
      description: 'Desafios cronometrados de vocabulário com bônus de voz.',
      icon: Swords,
      bg: 'var(--coral)',
      color: 'oklch(0.5 0.14 30)',
      action: 'Jogar',
    },
    {
      id: 'materials',
      title: 'Materiais',
      description: 'Vídeos e textos viram kits com IPA, gramática e cards.',
      icon: BookOpen,
      bg: 'var(--sunny)',
      color: 'oklch(0.62 0.16 45)',
      action: 'Explorar',
    },
    {
      id: 'misconceptions',
      title: 'Equívocos',
      description: 'Falsos cognatos e armadilhas mapeados pelo tutor.',
      icon: AlertCircle,
      bg: 'var(--mint)',
      color: 'var(--ok)',
      action: 'Revisar',
    },
    {
      id: 'graph',
      title: 'Grafo de memória',
      description: 'Conceitos, lacunas e conexões do seu aprendizado.',
      icon: Network,
      bg: 'var(--lavender)',
      color: 'oklch(0.48 0.08 300)',
      action: 'Explorar',
    },
    {
      id: 'achievements',
      title: 'Conquistas',
      description: `Nível ${stats.nivel} · ${stats.xp} XP · medalhas desbloqueadas.`,
      icon: Trophy,
      bg: 'var(--sunny)',
      color: 'oklch(0.62 0.16 45)',
      action: 'Celebrar',
    },
    {
      id: 'dashboard',
      title: 'Painel da semana',
      description: 'Tempo, precisão e hábito em um retrato calmo.',
      icon: BarChart3,
      bg: 'var(--accent-soft)',
      color: 'var(--accent-deep)',
      action: 'Abrir',
    },
  ];

  return (
    <div className="w-full space-y-10 pb-8 animate-fade-in">
      {/* Hero Section */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-4">
        <div className="lg:col-span-7 space-y-5 text-left">
          <div className="inline-flex items-center gap-2 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-2 text-xs sm:text-sm font-extrabold text-[var(--accent-deep)] shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>Sequência de {stats.sequencia_dias} dias — continue assim</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold font-display text-[var(--fg)] tracking-tight leading-tight">
            O que vamos <span className="text-[var(--accent-deep)]">aprender</span> hoje?
          </h1>

          <p className="text-base sm:text-lg text-[var(--muted)] max-w-xl font-normal leading-relaxed">
            Seu tutor de idiomas com memória de grafo: conversação, revisão espaçada e desafios que se adaptam ao que você já domina.
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => onNavigate('chat')}
              className="inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-extrabold text-sm sm:text-base bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-[0_4px_0_oklch(0.55_0.15_48)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_2px_0_oklch(0.5_0.14_45)] cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Conversar com o tutor</span>
            </button>

            <button
              onClick={() => onNavigate('duel')}
              className="inline-flex items-center justify-center gap-2.5 rounded-full px-6 py-3.5 font-extrabold text-sm sm:text-base bg-[var(--surface)] text-[var(--fg)] border-2 border-[var(--border)] hover:border-[var(--fg)] hover:-translate-y-0.5 transition cursor-pointer"
            >
              <Zap className="w-4 h-4 text-[var(--accent-deep)]" />
              <span>Duelo rápido de 2 min</span>
            </button>
          </div>
        </div>

        {/* Daily Goal Card */}
        <div className="lg:col-span-5">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 sm:p-7 shadow-[var(--shadow-sm)] flex items-center gap-6 text-left">
            <div className="relative w-28 h-28 shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="oklch(0.93 0.02 84)"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="314.16"
                  style={{
                    strokeDashoffset: strokeDashoffset,
                    transition: 'stroke-dashoffset 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-display font-bold text-2xl text-[var(--fg)] leading-none">
                  {currentMinutes}/{goalMinutes}
                </span>
                <span className="text-xs font-bold text-[var(--muted)] mt-0.5">min</span>
              </div>
            </div>

            <div className="space-y-1.5 flex-1">
              <h3 className="font-display text-lg font-bold text-[var(--fg)]">
                Meta de hoje
              </h3>
              <p className="text-xs sm:text-sm text-[var(--muted)] leading-snug">
                {goalMinutes} minutos de foco mantêm seu ritmo sem frustração.
              </p>
              <div className="inline-flex items-center gap-1.5 bg-[var(--sunny)] text-[var(--fg)] rounded-full px-3 py-1 text-xs font-extrabold mt-1">
                <Flame className="w-3.5 h-3.5 text-amber-700 fill-amber-700" />
                <span>{stats.sequencia_dias} dias seguidos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Espaços de Estudo Grid */}
      <section className="space-y-4 text-left">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[var(--fg)]">
            Seus espaços de estudo
          </h2>
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-xs sm:text-sm font-extrabold text-[var(--accent-deep)] hover:underline cursor-pointer"
          >
            Ver painel da semana →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4.5">
          {studySpaces.map((tile) => {
            const Icon = tile.icon;
            return (
              <div
                key={tile.id}
                onClick={() => onNavigate(tile.id)}
                className="group bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r)] p-5.5 shadow-[var(--shadow-sm)] flex flex-col gap-3 transition-all duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow)] cursor-pointer text-left"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                  style={{ background: tile.bg }}
                >
                  <Icon className="w-6 h-6" style={{ color: tile.color }} />
                </div>

                <h3 className="font-display font-bold text-lg text-[var(--fg)] group-hover:text-[var(--accent-deep)] transition">
                  {tile.title}
                </h3>

                <p className="text-xs sm:text-sm text-[var(--muted)] flex-1 leading-relaxed">
                  {tile.description}
                </p>

                <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[var(--accent-deep)] pt-1 group-hover:gap-2.5 transition-all">
                  <span>{tile.action}</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Continuar de onde parou Card */}
      <section className="bg-[var(--fg)] text-[oklch(0.95_0.01_84)] rounded-[var(--r-lg)] p-6 sm:p-8 shadow-[var(--shadow)] flex flex-col md:flex-row items-center gap-6 text-left">
        <div className="w-18 h-18 rounded-2xl bg-[var(--accent)] flex items-center justify-center shrink-0 shadow-[inset_0_-4px_0_oklch(0.55_0.15_48)]">
          <Play className="w-8 h-8 text-[var(--fg)] fill-[var(--fg)] ml-1" />
        </div>

        <div className="space-y-1.5 flex-1 w-full">
          <h3 className="font-display text-xl sm:text-2xl font-bold text-white">
            Continuar de onde parou
          </h3>
          <p className="text-xs sm:text-sm text-[oklch(0.80_0.03_285)]">
            {currentTopic} · 4 vocabulários no grafo de memória
          </p>
          <div className="w-full max-w-sm h-2.5 rounded-full bg-[oklch(0.42_0.06_285)] overflow-hidden mt-2">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--accent)] to-[var(--sunny)]"
              style={{ width: '42%' }}
            />
          </div>
        </div>

        <button
          onClick={() => onNavigate('materials')}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 font-extrabold text-sm bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-[0_4px_0_oklch(0.5_0.13_46)] hover:-translate-y-0.5 cursor-pointer shrink-0"
        >
          <span>Retomar aula</span>
        </button>
      </section>
    </div>
  );
};
