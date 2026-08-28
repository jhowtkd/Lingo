import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, Square, FastForward, Sparkles, Activity } from 'lucide-react';
import { SpeechService, NEURAL_VOICES } from '../services/speechSynthesisService';

interface TutorVoiceWaveformProps {
  isPlaying: boolean;
  activeId?: string | null;
  voiceName?: string;
  speed?: number;
  onStop?: () => void;
  onSpeedChange?: (newSpeed: number) => void;
  onVoiceChange?: (newVoice: string) => void;
  variant?: 'banner' | 'inline' | 'compact';
  title?: string;
}

export const TutorVoiceWaveform: React.FC<TutorVoiceWaveformProps> = ({
  isPlaying,
  activeId,
  voiceName = SpeechService.getPreferredVoice(),
  speed = 0.88,
  onStop,
  onSpeedChange,
  variant = 'inline',
  title = 'Voz Neural IA',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Estado interno para interpolação suave no Canvas sem re-renderizar o React
  const renderStateRef = useRef({
    phase: 0,
    smoothedVolume: 0.1,
    smoothedLow: 0.1,
    smoothedMid: 0.1,
    smoothedHigh: 0.1,
    bars: new Float32Array(24).fill(0.08),
  });

  const activeVoiceObj = NEURAL_VOICES.find((v) => v.id === voiceName) || NEURAL_VOICES[0];

  // Loop de Animação Canvas a 60 FPS com ZERO re-renders do React
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      // Limpa canvas para repouso
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    const freqBuffer = new Uint8Array(64);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      animFrameRef.current = requestAnimationFrame(render);

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;

      if (w <= 0 || h <= 0) return;

      // Ajusta resolução do canvas para Retina/High-DPI se necessário
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, w, h);

      // Obtém dados reais do analisador Web Audio
      const hasRealAudio = SpeechService.getByteFrequencyDataDirect(freqBuffer);
      let totalSum = 0;
      let lowSum = 0;
      let midSum = 0;
      let highSum = 0;

      if (hasRealAudio) {
        for (let i = 0; i < 32; i++) {
          const val = freqBuffer[i];
          totalSum += val;
          if (i < 6) lowSum += val;
          else if (i < 18) midSum += val;
          else highSum += val;
        }
      }

      const targetVol = hasRealAudio ? totalSum / (32 * 255) : 0.4;
      const targetLow = hasRealAudio ? lowSum / (6 * 255) : 0.45;
      const targetMid = hasRealAudio ? midSum / (12 * 255) : 0.5;
      const targetHigh = hasRealAudio ? highSum / (14 * 255) : 0.35;

      const s = renderStateRef.current;
      // Interpolação suave (lerp) para evitar qualquer tremor ou pulos bruscos
      s.smoothedVolume += (targetVol - s.smoothedVolume) * 0.18;
      s.smoothedLow += (targetLow - s.smoothedLow) * 0.2;
      s.smoothedMid += (targetMid - s.smoothedMid) * 0.18;
      s.smoothedHigh += (targetHigh - s.smoothedHigh) * 0.22;

      s.phase += 0.05 + s.smoothedVolume * 0.08;

      const isDark =
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;

      const primaryColor = isDark ? '#FFFFFF' : '#111827';
      const secondaryColor = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(17, 24, 39, 0.4)';

      // Renderiza Barras de Equalizador Suavizadas
      const numBars = variant === 'compact' ? 10 : 20;
      const gap = 3;
      const totalGaps = (numBars - 1) * gap;
      const barWidth = Math.max(3, Math.min(10, (w - totalGaps) / numBars));
      const totalWidth = numBars * barWidth + totalGaps;
      const startX = (w - totalWidth) / 2;

      for (let i = 0; i < numBars; i++) {
        const normIdx = i / numBars;
        let targetBar = 0.08;

        if (hasRealAudio) {
          const bufIdx = Math.floor(normIdx * 28);
          targetBar = Math.max(0.08, freqBuffer[bufIdx] / 255);
        } else {
          const centerDist = Math.abs(normIdx - 0.5) * 2;
          const envelope = Math.cos(centerDist * (Math.PI / 2));
          const wave = Math.sin(s.phase * 2 + i * 0.35) * 0.3 + 0.7;
          targetBar = Math.max(0.08, wave * s.smoothedVolume * envelope);
        }

        // Suaviza a altura da barra
        s.bars[i] += (targetBar - s.bars[i]) * 0.22;
        const currentNorm = Math.min(1, Math.max(0.08, s.bars[i]));

        const barHeight = Math.max(3, currentNorm * (h - 6));
        const x = startX + i * (barWidth + gap);
        const y = (h - barHeight) / 2;

        const radius = Math.min(barWidth / 2, 2.5);

        ctx.fillStyle = i % 2 === 0 ? primaryColor : secondaryColor;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, y, barWidth, barHeight, radius);
        } else {
          ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
      }
    };

    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [isPlaying, variant]);

  if (!isPlaying) return null;

  // Variante Compacta (dentro de pequenos botões ou tags)
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/60 border border-border/60">
        <canvas ref={canvasRef} className="w-16 h-3.5 block" />
      </div>
    );
  }

  // Variante Inline e Padrão (dentro da mensagem ativa)
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="mt-3 p-2.5 rounded-lg bg-muted/30 border border-border/80 font-mono text-xs shadow-2xs select-none"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        {/* Identificação do Tutor e Voz */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
          </span>
          <span className="font-semibold text-foreground text-[11px] truncate">
            {title} • {activeVoiceObj.name}
          </span>
        </div>

        {/* Controles de Velocidade e Parar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {onSpeedChange && (
            <button
              onClick={() => onSpeedChange(speed === 0.88 ? 1.0 : speed === 1.0 ? 1.15 : 0.88)}
              className="px-2 py-0.5 rounded bg-background hover:bg-muted text-foreground border border-border text-[10px] transition cursor-pointer flex items-center gap-1"
              title="Alterar velocidade de fala"
            >
              <FastForward className="w-2.5 h-2.5" />
              <span>{speed}x</span>
            </button>
          )}

          {onStop && (
            <button
              onClick={onStop}
              className="px-2 py-0.5 rounded bg-foreground text-background font-bold text-[10px] hover:opacity-90 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Interromper fala"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>Parar</span>
            </button>
          )}
        </div>
      </div>

      {/* Visualizador de Onda Sonora Suave via Canvas (Sem tremor, 60fps estável) */}
      <div
        ref={containerRef}
        className="h-8 w-full rounded bg-background/80 border border-border/60 flex items-center justify-center px-2 overflow-hidden"
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </motion.div>
  );
};
