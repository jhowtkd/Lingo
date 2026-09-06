import React, { useState, useEffect } from 'react';
import {
  Brain,
  Sparkles,
  Search,
  Sliders,
  PenTool,
  FastForward,
  CheckCircle,
  Activity,
  Layers,
  Clock,
} from 'lucide-react';

export type ThinkingPhase = 'analisando' | 'grafo' | 'pedagogia' | 'digitando';
export type ThinkingPauseSpeed = 'natural' | 'rapida' | 'instantanea';

interface ThinkingPauseIndicatorProps {
  currentTopic: string;
  studentLevel: string;
  phase: ThinkingPhase;
  progressPercent: number;
  onSkip?: () => void;
  speedMode: ThinkingPauseSpeed;
  onChangeSpeedMode?: (mode: ThinkingPauseSpeed) => void;
}

const PHASES_CONFIG: Record<
  ThinkingPhase,
  {
    step: number;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    bgColor: string;
  }
> = {
  analisando: {
    step: 1,
    title: 'Analisando Nuances & Intenção',
    description: 'Decodificando padrão gramatical, intenção comunicativa e vocabulário...',
    icon: Search,
    accentColor: 'text-sky-600 dark:text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/30',
  },
  grafo: {
    step: 2,
    title: 'Consultando Grafo de Memória',
    description: 'Cruzando com seu histórico de erros, conceitos correlatos e retenção...',
    icon: Brain,
    accentColor: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-500/10 border-indigo-500/30',
  },
  pedagogia: {
    step: 3,
    title: 'Calibrando Estratégia Pedagógica',
    description: 'Ajustando tom socrático e complexidade para maximizar sua autonomia...',
    icon: Sliders,
    accentColor: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
  },
  digitando: {
    step: 4,
    title: 'Tutor Formulando Réplica',
    description: 'Estruturando resposta natural, dicas contextuais e transcrição fonética...',
    icon: PenTool,
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10 border-emerald-500/30',
  },
};

export const ThinkingPauseIndicator: React.FC<ThinkingPauseIndicatorProps> = ({
  currentTopic,
  studentLevel,
  phase,
  progressPercent,
  onSkip,
  speedMode,
  onChangeSpeedMode,
}) => {
  const currentConfig = PHASES_CONFIG[phase] || PHASES_CONFIG.analisando;
  const PhaseIcon = currentConfig.icon;

  return (
    <div className="flex gap-3 justify-start items-start text-left animate-fade-in my-3">
      {/* Avatar do Tutor com Efeito de Pulso e Halo de Pensamento */}
      <div className="relative shrink-0 mt-0.5">
        <div className="w-9 h-9 rounded-full bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center font-bold text-xs shadow-md border-2 border-[var(--fg)] relative z-10">
          <Brain className="w-4.5 h-4.5 text-[var(--accent)] animate-pulse" />
        </div>
        {/* Halo animado */}
        <div className="absolute -inset-1 rounded-full bg-[var(--accent)] opacity-40 animate-ping" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-stone-950 flex items-center justify-center text-[9px] font-black shadow-xs z-20 border border-white dark:border-zinc-900 animate-bounce">
          ✨
        </div>
      </div>

      {/* Cartão Didático de Pensamento / Processamento */}
      <div className="max-w-[92%] sm:max-w-[85%] rounded-[var(--r-md)] p-4 sm:p-5 bg-[var(--surface)] text-[var(--fg)] border border-[var(--border)] shadow-md space-y-3 transition-all">
        {/* Cabeçalho da Pausa de Pensamento */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)]/70 pb-2.5">
          <div className="flex items-center space-x-2">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-extrabold tracking-wide uppercase text-[var(--fg)]">
              Tutor Processando
            </span>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-[oklch(0.95_0.01_84)] border border-[var(--border)] text-[var(--muted)]">
              Conversa Natural
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="text-[11px] font-bold text-[var(--muted)] hover:text-[var(--fg)] bg-[oklch(0.96_0.01_84)] hover:bg-[oklch(0.93_0.01_84)] border border-[var(--border)] px-2 py-0.5 rounded-md flex items-center gap-1 cursor-pointer transition shadow-2xs"
                title="Pular a pausa e exibir a resposta imediatamente"
              >
                <FastForward className="w-3 h-3" />
                <span>Pular Pausa</span>
              </button>
            )}
          </div>
        </div>

        {/* Etapa Atual em Destaque */}
        <div className={`p-3 rounded-lg border ${currentConfig.bgColor} flex items-start gap-3 transition-all`}>
          <div className="p-2 rounded-md bg-white/80 dark:bg-black/40 shrink-0 shadow-2xs">
            <PhaseIcon className={`w-4 h-4 ${currentConfig.accentColor} animate-spin-slow`} />
          </div>
          <div className="space-y-0.5 min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-[var(--fg)] tracking-tight">
                {currentConfig.title}
              </h4>
              <span className="text-[10px] font-mono font-bold text-[var(--muted)] shrink-0">
                Etapa {currentConfig.step}/4
              </span>
            </div>
            <p className="text-[11px] text-[var(--muted)] leading-relaxed">
              {currentConfig.description}
            </p>
          </div>
        </div>

        {/* Barra de Progresso Cognitivo */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-mono text-[var(--muted)]">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              <span>Simulação de Cadência Humana</span>
            </div>
            <span className="font-bold">{Math.round(progressPercent)}%</span>
          </div>

          <div className="w-full bg-[oklch(0.93_0.01_84)] h-1.5 rounded-full overflow-hidden border border-[var(--border)]/50">
            <div
              className="bg-gradient-to-r from-amber-500 via-indigo-500 to-emerald-500 h-full transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.min(100, Math.max(8, progressPercent))}%` }}
            />
          </div>

          {/* 4 Mini Steps Visuais */}
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {(Object.keys(PHASES_CONFIG) as ThinkingPhase[]).map((pKey, idx) => {
              const pItem = PHASES_CONFIG[pKey];
              const isPast = pItem.step < currentConfig.step;
              const isCurrent = pItem.step === currentConfig.step;

              return (
                <div
                  key={pKey}
                  className={`px-1.5 py-1 rounded text-center text-[9px] font-mono font-semibold transition border truncate ${
                    isCurrent
                      ? 'bg-[var(--fg)] text-[var(--accent)] border-[var(--fg)] shadow-2xs scale-[1.02]'
                      : isPast
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                      : 'bg-[oklch(0.96_0.01_84)] text-[var(--muted)] border-[var(--border)]'
                  }`}
                  title={pItem.title}
                >
                  <span>{isPast ? '✓ ' : ''}{pItem.title.split(' ')[0]}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chips Cognitivos de Contexto */}
        <div className="pt-2 border-t border-[var(--border)]/60 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-[var(--muted)]">
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-[var(--fg)]">
            <Brain className="w-3 h-3 text-indigo-500 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-[180px] font-semibold">{currentTopic}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-[var(--fg)]">
            <Activity className="w-3 h-3 text-emerald-500 shrink-0" />
            <span>Nível {studentLevel}</span>
          </div>
          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-[var(--fg)]">
            <Clock className="w-3 h-3 text-amber-500 shrink-0" />
            <span>Pausa ativa ({speedMode === 'natural' ? '~1.8s' : speedMode === 'rapida' ? '~0.8s' : '0s'})</span>
          </div>
        </div>
      </div>
    </div>
  );
};
