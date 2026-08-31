import React, { useState } from 'react';
import {
  Gauge,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SpeechRateMetrics } from '../types';
import {
  SpeechRateService,
  CEFR_SPEECH_RATE_TARGETS,
} from '../services/speechRateService';

interface SpeechRateVisualizerProps {
  metrics: SpeechRateMetrics;
  variant?: 'compact' | 'full' | 'inline-badge';
  className?: string;
}

export const SpeechRateVisualizer: React.FC<SpeechRateVisualizerProps> = ({
  metrics: initialMetrics,
  variant = 'compact',
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const currentMetrics = initialMetrics;
  const activeLevel = initialMetrics.cefrLevel || 'B1';

  const badgeProps = SpeechRateService.getPacingBadgeProps(currentMetrics.pacing);
  const targetConfig = CEFR_SPEECH_RATE_TARGETS[activeLevel] || CEFR_SPEECH_RATE_TARGETS.B1;

  // Cálculo da posição no medidor (escala de 0 a 220 PPM)
  const maxScaleWpm = 220;
  const clampedWpm = Math.min(maxScaleWpm, Math.max(0, currentMetrics.wpm));
  const markerPercent = Math.min(98, Math.max(2, (clampedWpm / maxScaleWpm) * 100));

  // Faixa ideal em percentual no medidor
  const targetMinPercent = (targetConfig.minWpm / maxScaleWpm) * 100;
  const targetMaxPercent = (targetConfig.maxWpm / maxScaleWpm) * 100;
  const targetWidthPercent = targetMaxPercent - targetMinPercent;

  // 1. Variante Inline Badge (Ultra compacta para cabeçalhos / review)
  if (variant === 'inline-badge') {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${badgeProps.bg} ${badgeProps.border} ${badgeProps.color} ${className}`}
        title={`Taxa de fala: ${currentMetrics.wpm} PPM (${badgeProps.label} para o nível ${activeLevel})`}
      >
        <Gauge className="w-3.5 h-3.5 shrink-0" />
        <span className="font-bold font-mono">{currentMetrics.wpm} PPM</span>
        <span className="opacity-40">•</span>
        <span>{badgeProps.label}</span>
      </div>
    );
  }

  // 2. Variante Compacta (Para balões de chat)
  if (variant === 'compact') {
    return (
      <div
        className={`relative mt-2 border border-border/80 bg-card rounded-xl p-3 text-xs shadow-xs transition-all ${className}`}
      >
        {/* Top Header do Medidor */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <div className="p-1 rounded-lg bg-secondary text-foreground">
              <Gauge className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground tracking-tight">
                  Taxa de Fala:
                </span>
                <span className="font-bold text-foreground font-mono">
                  {currentMetrics.wpm}{' '}
                  <span className="text-[10px] font-normal text-muted-foreground">PPM</span>
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {currentMetrics.wordsCount} palavras em {currentMetrics.durationSeconds}s • Nível {activeLevel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeProps.bg} ${badgeProps.border} ${badgeProps.color}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${badgeProps.dot}`} />
              <span>{badgeProps.label}</span>
            </span>

            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1 hover:bg-secondary rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer"
              title={isExpanded ? 'Recolher detalhes' : 'Expandir análise detalhada de ritmo'}
            >
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Barra Visual de Ritmo com Zona Ideal Marcada */}
        <div className="mt-2.5 space-y-1">
          <div className="relative h-2.5 w-full bg-muted/60 rounded-full overflow-hidden border border-border/40">
            {/* Faixa Ideal do Nível */}
            <div
              className="absolute top-0 bottom-0 bg-emerald-500/25 border-x border-emerald-500/50"
              style={{
                left: `${targetMinPercent}%`,
                width: `${targetWidthPercent}%`,
              }}
              title={`Faixa Ideal para ${activeLevel}: ${targetConfig.minWpm} a ${targetConfig.maxWpm} PPM`}
            />

            {/* Marcador do Aluno */}
            <motion.div
              className="absolute top-0 bottom-0 w-2 -ml-1 rounded-full bg-foreground shadow-xs border border-background z-10"
              style={{ left: `${markerPercent}%` }}
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {/* Legenda dos limites da régua */}
          <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
            <span>0 PPM (Pausado)</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              Zona Ideal {activeLevel}: {targetConfig.minWpm}-{targetConfig.maxWpm} PPM
            </span>
            <span>220+ PPM (Muito Rápido)</span>
          </div>
        </div>

        {/* Painel Expansível de Insights Pedagógicos */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 pt-2.5 border-t border-border/60 space-y-2.5"
            >
              {/* Feedback Descritivo & Dica de Pacing */}
              <div className="p-2 rounded bg-muted/40 border border-border/60 text-[11px] space-y-1">
                <p className="text-foreground">{currentMetrics.feedbackText}</p>
                <p className="text-muted-foreground text-[10px] leading-relaxed">
                  {currentMetrics.pacingTip}
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // 3. Variante Completa (Painel de Análise / Dashboard / Modal)
  return (
    <div
      className={`relative border border-border/80 bg-card rounded-2xl p-4 sm:p-5 shadow-xs overflow-hidden ${className}`}
    >
      {/* Header Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-secondary text-foreground flex items-center justify-center shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-foreground text-sm sm:text-base tracking-tight">
                Análise de Taxa de Fala (WPM)
              </h3>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeProps.bg} ${badgeProps.border} ${badgeProps.color}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${badgeProps.dot}`} />
                <span>{badgeProps.label}</span>
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Palavras por Minuto calibradas pelo Quadro Europeu Comum (CEFR)
            </p>
          </div>
        </div>

        {/* Métricas Rápidas em Grid */}
        <div className="flex items-center gap-2 sm:gap-3 bg-secondary/50 p-2 rounded-xl border border-border/60 text-center">
          <div className="px-2">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
              Velocidade
            </span>
            <span className="text-base font-bold text-foreground font-mono">
              {currentMetrics.wpm}{' '}
              <span className="text-[10px] font-normal text-muted-foreground">PPM</span>
            </span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="px-2">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
              Palavras
            </span>
            <span className="text-base font-bold text-foreground font-mono">
              {currentMetrics.wordsCount}
            </span>
          </div>
          <div className="w-px h-6 bg-border" />
          <div className="px-2">
            <span className="text-[10px] text-muted-foreground block uppercase font-bold tracking-wider">
              Duração
            </span>
            <span className="text-base font-bold text-foreground font-mono">
              {currentMetrics.durationSeconds}s
            </span>
          </div>
        </div>
      </div>

      {/* Régua Gráfica de Pacing */}
      <div className="my-4 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-muted-foreground font-semibold">
            Régua de Ritmo & Velocidade:
          </span>
          <span className="text-foreground font-bold">
            Zona Alvo ({activeLevel}):{' '}
            <strong className="text-emerald-600 dark:text-emerald-400">
              {targetConfig.minWpm} a {targetConfig.maxWpm} PPM
            </strong>
          </span>
        </div>

        <div className="relative h-4 w-full bg-muted rounded-full overflow-hidden border border-border">
          {/* Zona Lenta */}
          <div
            className="absolute top-0 bottom-0 left-0 bg-sky-500/15"
            style={{ width: `${targetMinPercent}%` }}
          />

          {/* Zona Ideal */}
          <div
            className="absolute top-0 bottom-0 bg-emerald-500/30 border-x-2 border-emerald-500"
            style={{
              left: `${targetMinPercent}%`,
              width: `${targetWidthPercent}%`,
            }}
          />

          {/* Zona Acelerada */}
          <div
            className="absolute top-0 bottom-0 right-0 bg-rose-500/15"
            style={{ left: `${targetMaxPercent}%`, right: 0 }}
          />

          {/* Marcador do Aluno */}
          <motion.div
            className="absolute top-0 bottom-0 w-2.5 -ml-1.5 rounded-full bg-foreground shadow-md border-2 border-background z-20"
            style={{ left: `${markerPercent}%` }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ type: 'spring', damping: 15 }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0 PPM (Hesitação)</span>
          <span className="text-sky-600 dark:text-sky-400">Lento</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            Faixa Ideal ({activeLevel})
          </span>
          <span className="text-amber-600 dark:text-amber-400">Acelerado</span>
          <span>220+ PPM (Sob Pressão)</span>
        </div>
      </div>

      {/* Caixa de Feedback e Dicas de Ritmo */}
      <div className="p-3.5 rounded-lg bg-muted/30 border border-border space-y-2 text-xs">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-foreground mt-0.5 shrink-0" />
          <div>
            <p className="font-bold text-foreground">{currentMetrics.feedbackText}</p>
            <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
              {currentMetrics.pacingTip}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
