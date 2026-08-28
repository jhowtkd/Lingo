import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, Waves, BarChart2, Radio, Sparkles, Volume2, Square } from 'lucide-react';
import { SpeechService, NEURAL_VOICES } from '../services/speechSynthesisService';

export type WaveVisualizerMode = 'harmonic_waves' | 'frequency_bars' | 'voice_orb';

export interface TutorAudioWaveVisualizerProps {
  isPlaying?: boolean;
  activeId?: string | null;
  voiceName?: string;
  height?: number;
  mode?: WaveVisualizerMode;
  showControls?: boolean;
  showMetrics?: boolean;
  showModeSwitcher?: boolean;
  className?: string;
  onStop?: () => void;
  accentColor?: string;
}

export const TutorAudioWaveVisualizer: React.FC<TutorAudioWaveVisualizerProps> = ({
  isPlaying = false,
  activeId,
  voiceName = SpeechService.getPreferredVoice(),
  height = 96,
  mode: initialMode = 'harmonic_waves',
  showControls = true,
  showMetrics = true,
  showModeSwitcher = true,
  className = '',
  onStop,
  accentColor,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentMode, setCurrentMode] = useState<WaveVisualizerMode>(initialMode);
  const [intensity, setIntensity] = useState<number>(0);
  const [dominantFrequency, setDominantFrequency] = useState<number>(0);
  const [speechState, setSpeechState] = useState<'Silêncio' | 'Vocalizando' | 'Ênfase Alta' | 'Pausa Natural'>('Silêncio');

  // Variáveis de animação e interpolação mantidas em ref para 60FPS
  const stateRef = useRef({
    phase: 0,
    smoothedVolume: 0,
    smoothedFreqs: new Float32Array(64).fill(0),
    smoothedLow: 0,
    smoothedMid: 0,
    smoothedHigh: 0,
    animFrame: 0 as number | null,
    width: 300,
    height: 96,
  });

  const activeVoice = NEURAL_VOICES.find((v) => v.id === voiceName) || NEURAL_VOICES[0];

  // Observa redimensionamento do container
  useEffect(() => {
    if (!containerRef.current) return;

    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(120, Math.floor(rect.width));
        const h = Math.max(40, height);

        stateRef.current.width = w;
        stateRef.current.height = h;

        canvasRef.current.width = w * dpr;
        canvasRef.current.height = h * dpr;
        canvasRef.current.style.width = `${w}px`;
        canvasRef.current.style.height = `${h}px`;

        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [height]);

  // Loop de renderização Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const freqBuffer = new Uint8Array(128);
    const timeBuffer = new Uint8Array(128);

    let lastMetricsUpdate = 0;

    const render = (time: number) => {
      stateRef.current.animFrame = requestAnimationFrame(render);

      const { width, height } = stateRef.current;
      if (width <= 0 || height <= 0) return;

      // Obtém dados reais do analisador Web Audio
      const hasRealAudio = SpeechService.getByteFrequencyDataDirect(freqBuffer);
      SpeechService.getByteTimeDomainDataDirect(timeBuffer);

      // Calcula energias por bandas vocais (Low: 80-350Hz, Mid: 350-2500Hz, High: 2500-8000Hz)
      let lowSum = 0;
      let midSum = 0;
      let highSum = 0;
      let totalSum = 0;
      let maxVal = 0;
      let maxIdx = 0;

      if (hasRealAudio && isPlaying) {
        for (let i = 0; i < 64; i++) {
          const val = freqBuffer[i];
          totalSum += val;
          if (val > maxVal) {
            maxVal = val;
            maxIdx = i;
          }
          if (i < 8) lowSum += val;
          else if (i < 32) midSum += val;
          else highSum += val;
        }
      }

      const targetVol = isPlaying ? (hasRealAudio ? totalSum / (64 * 255) : 0.45) : 0;
      const targetLow = isPlaying ? (hasRealAudio ? lowSum / (8 * 255) : 0.4) : 0;
      const targetMid = isPlaying ? (hasRealAudio ? midSum / (24 * 255) : 0.5) : 0;
      const targetHigh = isPlaying ? (hasRealAudio ? highSum / (32 * 255) : 0.35) : 0;

      // Interpolação suave (lerp) para dinâmica orgânica similar à respiração/prosódia
      const s = stateRef.current;
      s.smoothedVolume += (targetVol - s.smoothedVolume) * 0.18;
      s.smoothedLow += (targetLow - s.smoothedLow) * 0.2;
      s.smoothedMid += (targetMid - s.smoothedMid) * 0.18;
      s.smoothedHigh += (targetHigh - s.smoothedHigh) * 0.22;

      // Atualiza fase com base na atividade vocal
      const speed = isPlaying ? 0.04 + s.smoothedVolume * 0.08 : 0.01;
      s.phase += speed;

      // Limpa canvas
      ctx.clearRect(0, 0, width, height);

      // Detecta cores do tema atual através do CSS Computed
      const isDark = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      
      const primaryColor = accentColor || (isDark ? '#FFFFFF' : '#111827');
      const secondaryColor = isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(17, 24, 39, 0.45)';
      const tertiaryColor = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(17, 24, 39, 0.2)';

      // 1. MODO: HARMONIC WAVES (Ondas Harmônicas Contínuas com Formantes)
      if (currentMode === 'harmonic_waves') {
        const midY = height / 2;
        const maxAmp = height * 0.42;

        // Configuração das camadas de onda com frequências e fases distintas
        const waves = [
          {
            // Onda de Formante Primário (Grosso e Laranja/Vocal Core)
            freq: 0.018 + s.smoothedLow * 0.008,
            amp: (0.15 + s.smoothedVolume * 0.85) * maxAmp,
            phase: s.phase * 1.6,
            lineWidth: 2.5,
            color: primaryColor,
            fillAlpha: isDark ? 0.08 : 0.05,
          },
          {
            // Onda de Harmônico Médio (Contra-fase)
            freq: 0.026 + s.smoothedMid * 0.01,
            amp: (0.1 + s.smoothedMid * 0.7) * (maxAmp * 0.8),
            phase: -s.phase * 1.9 + Math.PI / 3,
            lineWidth: 1.8,
            color: secondaryColor,
            fillAlpha: 0,
          },
          {
            // Onda de Micro-Articulação Aguda (Ressonância Fonética)
            freq: 0.045 + s.smoothedHigh * 0.02,
            amp: (0.05 + s.smoothedHigh * 0.6) * (maxAmp * 0.55),
            phase: s.phase * 2.8 + Math.PI / 1.5,
            lineWidth: 1.2,
            color: tertiaryColor,
            fillAlpha: 0,
          },
        ];

        // Desenha cada onda harmônica
        waves.forEach((w, waveIdx) => {
          ctx.beginPath();
          ctx.lineWidth = w.lineWidth;
          ctx.strokeStyle = w.color;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Envelope de amplitude em sino (Hanning window) para fixar as pontas nas extremidades
          for (let x = 0; x <= width; x += 3) {
            const normX = x / width; // 0 to 1
            const envelope = Math.sin(normX * Math.PI); // 0 at edges, 1 in center
            const modulation = Math.sin(x * w.freq + w.phase) * Math.cos(x * 0.008 + w.phase * 0.5);
            const y = midY + modulation * w.amp * envelope;

            if (x === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }

          ctx.stroke();

          // Preenchimento gradiente sob a onda principal
          if (w.fillAlpha > 0 && isPlaying) {
            ctx.lineTo(width, height);
            ctx.lineTo(0, height);
            ctx.closePath();

            const grad = ctx.createLinearGradient(0, midY - w.amp, 0, height);
            grad.addColorStop(0, isDark ? `rgba(255, 255, 255, ${0.12 * s.smoothedVolume})` : `rgba(0, 0, 0, ${0.08 * s.smoothedVolume})`);
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fill();
          }
        });

        // Linha central sutil de repouso
        if (!isPlaying || s.smoothedVolume < 0.05) {
          ctx.beginPath();
          ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
          ctx.lineWidth = 1;
          ctx.moveTo(0, midY);
          ctx.lineTo(width, midY);
          ctx.stroke();
        }
      }

      // 2. MODO: FREQUENCY BARS (Bandas Vocais Formantes)
      else if (currentMode === 'frequency_bars') {
        const numBars = Math.min(36, Math.floor(width / 8));
        const barWidth = Math.max(3, (width / numBars) - 2);
        const gap = 2;
        const maxBarH = height * 0.85;

        for (let i = 0; i < numBars; i++) {
          const normIdx = i / numBars;
          let barHeightNorm = 0.08;

          if (isPlaying) {
            if (hasRealAudio) {
              const dataIdx = Math.floor(normIdx * 60);
              barHeightNorm = Math.max(0.06, freqBuffer[dataIdx] / 255);
            } else {
              // Simulação harmônica com envelope vocal natural
              const centerDist = Math.abs(normIdx - 0.35) * 2;
              const envelope = Math.max(0.1, 1 - centerDist * 0.8);
              const osc = Math.sin(s.phase * 2 + i * 0.4) * 0.3 + 0.7;
              barHeightNorm = Math.max(0.08, osc * s.smoothedVolume * envelope);
            }
          }

          const barH = Math.max(3, barHeightNorm * maxBarH);
          const x = i * (barWidth + gap) + (width - (numBars * (barWidth + gap))) / 2;
          const y = height - barH - 4;

          const radius = Math.min(barWidth / 2, 2);
          ctx.fillStyle = i % 2 === 0 ? primaryColor : secondaryColor;

          // Desenha barra arredondada
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [radius, radius, 0, 0]) : ctx.rect(x, y, barWidth, barH);
          ctx.fill();

          // Cap / Ponto no topo
          if (isPlaying && barHeightNorm > 0.3) {
            ctx.fillStyle = primaryColor;
            ctx.fillRect(x, y - 2, barWidth, 1.5);
          }
        }
      }

      // 3. MODO: VOICE ORB (Pulso Radial e Anéis de Ressonância)
      else if (currentMode === 'voice_orb') {
        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.22;
        const activeRadius = baseRadius + (s.smoothedVolume * baseRadius * 0.8);

        // Anéis concêntricos de ressonância
        const rings = [
          { scale: 1.6, alpha: 0.12 * s.smoothedVolume, width: 1 },
          { scale: 1.3, alpha: 0.25 * s.smoothedVolume, width: 1.5 },
          { scale: 1.0, alpha: 0.85, width: 2.5 },
        ];

        rings.forEach((r) => {
          ctx.beginPath();
          ctx.arc(centerX, centerY, activeRadius * r.scale, 0, Math.PI * 2);
          ctx.strokeStyle = isDark ? `rgba(255, 255, 255, ${r.alpha})` : `rgba(17, 24, 39, ${r.alpha})`;
          ctx.lineWidth = r.width;
          ctx.stroke();
        });

        // Núcleo central com ondulação orgânica
        const numPoints = 32;
        ctx.beginPath();
        for (let i = 0; i <= numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const wave = isPlaying
            ? Math.sin(angle * 4 + s.phase * 3) * (4 * s.smoothedMid) +
              Math.cos(angle * 6 - s.phase * 2) * (2 * s.smoothedHigh)
            : 0;
          const r = activeRadius * 0.7 + wave;
          const x = centerX + Math.cos(angle) * r;
          const y = centerY + Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = primaryColor;
        ctx.fill();
      }

      // Atualiza métricas reativas a cada ~120ms para o React UI
      if (time - lastMetricsUpdate > 120) {
        lastMetricsUpdate = time;
        const volPct = Math.round(s.smoothedVolume * 100);
        setIntensity(volPct);

        const approxFreq = Math.round(maxIdx * (22050 / 64));
        setDominantFrequency(approxFreq);

        if (!isPlaying || volPct < 5) {
          setSpeechState('Silêncio');
        } else if (volPct > 65) {
          setSpeechState('Ênfase Alta');
        } else if (volPct > 15) {
          setSpeechState('Vocalizando');
        } else {
          setSpeechState('Pausa Natural');
        }
      }
    };

    stateRef.current.animFrame = requestAnimationFrame(render);

    return () => {
      if (stateRef.current.animFrame) {
        cancelAnimationFrame(stateRef.current.animFrame);
        stateRef.current.animFrame = null;
      }
    };
  }, [isPlaying, currentMode, accentColor, height]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-lg bg-card/90 border border-border/80 p-3 shadow-xs font-mono select-none overflow-hidden ${className}`}
    >
      {/* Cabeçalho do Visualizador */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-6 h-6 rounded bg-foreground text-background font-bold text-xs shadow-2xs">
            {isPlaying ? (
              <Activity className="w-3.5 h-3.5 animate-pulse" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 opacity-60" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <span>SAÍDA DE VOZ DO TUTOR</span>
              {isPlaying && (
                <span className="flex h-1.5 w-1.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-foreground"></span>
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
              <span>{activeVoice.name}</span>
              <span>•</span>
              <span className="text-foreground/80 font-semibold">{speechState}</span>
            </div>
          </div>
        </div>

        {/* Seletor de Modo de Visualização */}
        <div className="flex items-center gap-1.5">
          {showModeSwitcher && (
            <div className="flex items-center bg-muted/60 p-0.5 rounded border border-border/60 text-[10px]">
              <button
                onClick={() => setCurrentMode('harmonic_waves')}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  currentMode === 'harmonic_waves'
                    ? 'bg-foreground text-background font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Ondas Harmônicas Contínuas"
              >
                <Waves className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Harmônica</span>
              </button>

              <button
                onClick={() => setCurrentMode('frequency_bars')}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  currentMode === 'frequency_bars'
                    ? 'bg-foreground text-background font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Barras de Frequência e Formantes"
              >
                <BarChart2 className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Espectro</span>
              </button>

              <button
                onClick={() => setCurrentMode('voice_orb')}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  currentMode === 'voice_orb'
                    ? 'bg-foreground text-background font-bold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Pulso de Ressonância e Orb Vocal"
              >
                <Radio className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Orb</span>
              </button>
            </div>
          )}

          {/* Botão Parar */}
          {isPlaying && onStop && (
            <button
              onClick={onStop}
              className="px-2 py-1 rounded bg-foreground text-background font-bold text-[10px] hover:opacity-90 transition cursor-pointer flex items-center gap-1 shadow-2xs"
              title="Interromper fala do tutor"
            >
              <Square className="w-2.5 h-2.5 fill-current" />
              <span>PARAR</span>
            </button>
          )}
        </div>
      </div>

      {/* Canvas da Onda Sonora em Alta Resolução */}
      <div className="relative w-full overflow-hidden rounded bg-muted/30 border border-border/40 flex items-center justify-center">
        <canvas ref={canvasRef} className="block w-full" />

        {/* Aura animada ao fundo */}
        <AnimatePresence>
          {isPlaying && intensity > 10 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: intensity / 100 * 0.15 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none bg-radial from-foreground/20 to-transparent"
            />
          )}
        </AnimatePresence>
      </div>

      {/* Métricas de Intensidade Vocal & Formantes em Tempo Real */}
      {showMetrics && (
        <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span>Intensidade:</span>
              <span className="font-bold text-foreground">{intensity}%</span>
            </div>
            {dominantFrequency > 0 && isPlaying && (
              <div className="hidden sm:flex items-center gap-1">
                <span>Formante:</span>
                <span className="font-bold text-foreground">{dominantFrequency} Hz</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-foreground" />
            <span>Gemini Neural 24kHz</span>
          </div>
        </div>
      )}
    </div>
  );
};
