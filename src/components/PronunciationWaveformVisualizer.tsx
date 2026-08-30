import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, Activity, BarChart2, Radio, Volume2, Sparkles, Zap, Waves } from 'lucide-react';

interface PronunciationWaveformVisualizerProps {
  stream?: MediaStream | null;
  isActive?: boolean;
  height?: number;
  mode?: 'waveform' | 'bars' | 'smooth-curve';
  showControls?: boolean;
  showMetrics?: boolean;
  showPitchBand?: boolean;
  title?: string;
  targetPhrase?: string;
  accentColor?: string;
  className?: string;
}

export const PronunciationWaveformVisualizer: React.FC<PronunciationWaveformVisualizerProps> = ({
  stream,
  isActive = true,
  height = 96,
  mode = 'waveform',
  showControls = true,
  showMetrics = true,
  showPitchBand = true,
  title = 'Visualizador de Onda Vocal em Tempo Real',
  targetPhrase,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualMode, setVisualMode] = useState<'waveform' | 'bars' | 'smooth-curve'>(mode);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [peakFreq, setPeakFreq] = useState<number>(0);
  const [voiceClarity, setVoiceClarity] = useState<'Silêncio' | 'Voz Clara' | 'Voz Forte' | 'Ruído'>('Silêncio');
  const [dbLevel, setDbLevel] = useState<number>(-90);

  const animFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // History buffer for smooth scrolling waveform
  const historyBufferRef = useRef<number[]>(new Array(128).fill(128));

  useEffect(() => {
    if (!stream || !isActive) {
      cleanupAudio();
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      renderLoop();
    } catch (err) {
      console.error('Erro ao iniciar Analisador de Áudio Web Audio:', err);
    }

    return () => {
      cleanupAudio();
    };
  }, [stream, isActive, visualMode]);

  const cleanupAudio = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch (e) {}
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCurrentVolume(0);
    setPeakFreq(0);
    setVoiceClarity('Silêncio');
    setDbLevel(-90);
  };

  const renderLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    const draw = () => {
      animFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      // 1. Calcular Volume RMS e Decibéis
      let sumSquares = 0;
      let maxVal = 0;
      let maxIdx = 0;

      for (let i = 0; i < bufferLength; i++) {
        const norm = (timeData[i] - 128) / 128;
        sumSquares += norm * norm;

        const freqVal = freqData[i];
        if (freqVal > maxVal) {
          maxVal = freqVal;
          maxIdx = i;
        }
      }

      const rms = Math.sqrt(sumSquares / bufferLength);
      const calculatedDb = rms > 0.0001 ? Math.round(20 * Math.log10(rms)) : -90;
      setDbLevel(calculatedDb);

      const volPct = Math.min(100, Math.round(rms * 280));
      setCurrentVolume(volPct);

      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const freqHz = Math.round((maxIdx * sampleRate) / (analyser.fftSize * 2));
      setPeakFreq(freqHz);

      if (volPct < 4) {
        setVoiceClarity('Silêncio');
      } else if (volPct < 65) {
        setVoiceClarity('Voz Clara');
      } else if (volPct < 90) {
        setVoiceClarity('Voz Forte');
      } else {
        setVoiceClarity('Ruído');
      }

      // 2. Renderização no Canvas
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const h = height;

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(h * dpr);
        ctx.scale(dpr, dpr);
      }

      ctx.clearRect(0, 0, width, h);

      // Fundo suave com grid de osciloscópio
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, h);

      // Grade horizontal de referência de amplitude
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.25);
      ctx.lineTo(width, h * 0.25);
      ctx.moveTo(0, h * 0.5);
      ctx.lineTo(width, h * 0.5);
      ctx.moveTo(0, h * 0.75);
      ctx.lineTo(width, h * 0.75);
      ctx.stroke();

      if (visualMode === 'waveform') {
        drawOscilloscope(ctx, width, h, timeData, bufferLength);
      } else if (visualMode === 'smooth-curve') {
        drawSmoothCurve(ctx, width, h, timeData, bufferLength);
      } else {
        drawFrequencyBars(ctx, width, h, freqData, bufferLength);
      }
    };

    draw();
  };

  const drawOscilloscope = (
    ctx: CanvasRenderingContext2D,
    width: number,
    h: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    // Linha de centro de repouso com brilho
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(width, h / 2);
    ctx.stroke();

    // Gradiente da Onda
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#38bdf8');
    grad.addColorStop(0.35, '#818cf8');
    grad.addColorStop(0.7, '#34d399');
    grad.addColorStop(1, '#fbbf24');

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = grad;
    ctx.beginPath();

    const sliceWidth = width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width, h / 2);
    ctx.stroke();

    // Glow suave
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(129, 140, 248, 0.5)';
    ctx.stroke();
    ctx.shadowBlur = 0;
  };

  const drawSmoothCurve = (
    ctx: CanvasRenderingContext2D,
    width: number,
    h: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    const pointsCount = 48;
    const step = Math.floor(bufferLength / pointsCount);
    const sliceWidth = width / (pointsCount - 1);

    ctx.beginPath();
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, '#10b981');
    grad.addColorStop(0.5, '#6366f1');
    grad.addColorStop(1, '#f43f5e');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;

    const coords: { x: number; y: number }[] = [];
    for (let i = 0; i < pointsCount; i++) {
      const idx = Math.min(bufferLength - 1, i * step);
      const v = data[idx] / 128.0;
      const y = (v * h) / 2;
      const x = i * sliceWidth;
      coords.push({ x, y });
    }

    ctx.moveTo(coords[0].x, coords[0].y);
    for (let i = 1; i < coords.length - 1; i++) {
      const xc = (coords[i].x + coords[i + 1].x) / 2;
      const yc = (coords[i].y + coords[i + 1].y) / 2;
      ctx.quadraticCurveTo(coords[i].x, coords[i].y, xc, yc);
    }
    if (coords.length > 1) {
      ctx.lineTo(coords[coords.length - 1].x, coords[coords.length - 1].y);
    }
    ctx.stroke();
  };

  const drawFrequencyBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    h: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    const barCount = 40;
    const barSpacing = 3;
    const totalSpacing = barSpacing * (barCount - 1);
    const barWidth = Math.max(3, (width - totalSpacing - 16) / barCount);
    const startX = (width - (barCount * barWidth + totalSpacing)) / 2;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.min(
        bufferLength - 1,
        Math.floor(Math.pow(i / barCount, 1.3) * (bufferLength * 0.7))
      );
      const value = data[dataIndex] || 0;
      const normalizedHeight = (value / 255) * (h - 16);
      const barHeight = Math.max(3, normalizedHeight);

      const x = startX + i * (barWidth + barSpacing);
      const y = h - barHeight - 6;

      const gradient = ctx.createLinearGradient(0, h, 0, y);
      if (i < barCount * 0.3) {
        gradient.addColorStop(0, '#6366f1');
        gradient.addColorStop(1, '#818cf8');
      } else if (i < barCount * 0.7) {
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(1, '#34d399');
      } else {
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(1, '#fbbf24');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
      } else {
        ctx.rect(x, y, barWidth, barHeight);
      }
      ctx.fill();

      // Pico superior
      if (barHeight > 6) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y - 2, barWidth, 1.5);
      }
    }
  };

  return (
    <div
      className={`w-full bg-[oklch(0.16_0.02_260)] border border-[oklch(0.25_0.03_260)] rounded-xl overflow-hidden shadow-md flex flex-col font-mono select-none ${className}`}
    >
      {/* Top Header do Visualizador */}
      <div className="px-3.5 py-2 bg-[oklch(0.12_0.02_260)] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            {stream && isActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-600"></span>
            )}
          </span>
          <div className="flex items-center space-x-2 truncate">
            <span className="font-bold text-white text-[11px] truncate">{title}</span>
            {stream && isActive && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                MIC ATIVO
              </span>
            )}
          </div>
        </div>

        {/* Seleção de Modos de Visualização */}
        {showControls && (
          <div className="flex items-center space-x-1 shrink-0">
            <button
              type="button"
              onClick={() => setVisualMode('waveform')}
              title="Onda Contínua (Osciloscópio)"
              className={`p-1.5 rounded transition cursor-pointer ${
                visualMode === 'waveform'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('smooth-curve')}
              title="Curva Suavizada Harmônica"
              className={`p-1.5 rounded transition cursor-pointer ${
                visualMode === 'smooth-curve'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('bars')}
              title="Espectro de Frequências (Formantes Vocais)"
              className={`p-1.5 rounded transition cursor-pointer ${
                visualMode === 'bars'
                  ? 'bg-indigo-600 text-white font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Frase Alvo / Dica se fornecida */}
      {targetPhrase && (
        <div className="px-3.5 py-1.5 bg-indigo-950/40 border-b border-indigo-500/20 text-[11px] text-indigo-200 flex items-center justify-between">
          <span className="truncate">
            <strong className="text-indigo-400">Pratique a fala:</strong> "{targetPhrase}"
          </span>
          <span className="text-[10px] text-indigo-300/70 shrink-0 ml-2">Fale no microfone</span>
        </div>
      )}

      {/* Área do Canvas do Visualizador */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <canvas ref={canvasRef} className="w-full h-full block" />

        {(!stream || !isActive) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-2xs text-white/70 text-xs px-4 text-center">
            <span className="flex items-center space-x-2">
              <Mic className="w-4 h-4 text-indigo-400 animate-pulse" />
              <span>Aguardando ativação do microfone para captar ondas sonoras da pronúncia...</span>
            </span>
          </div>
        )}
      </div>

      {/* Barra Inferior com Métricas de Intensidade, Pitch e Decibéis */}
      {showMetrics && (
        <div className="px-3.5 py-2 bg-[oklch(0.12_0.02_260)] border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-white/70">
          <div className="flex items-center space-x-2 flex-1 min-w-[140px] max-w-xs">
            <span className="text-white/60">Volume:</span>
            <div className="flex-1 bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  currentVolume > 80
                    ? 'bg-rose-500'
                    : currentVolume > 50
                    ? 'bg-amber-400'
                    : 'bg-emerald-400'
                }`}
                style={{ width: `${currentVolume}%` }}
              />
            </div>
            <span className="font-bold text-white">{currentVolume}%</span>
          </div>

          <div className="flex items-center space-x-3 text-white/80">
            {peakFreq > 0 && (
              <span>
                Frequência: <strong className="text-indigo-300">{peakFreq} Hz</strong>
              </span>
            )}
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                voiceClarity === 'Voz Clara'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : voiceClarity === 'Voz Forte'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {voiceClarity}
            </span>
            <span>Faixa Vocal (80Hz - 4kHz)</span>
          </div>
        </div>
      )}
    </div>
  );
};
