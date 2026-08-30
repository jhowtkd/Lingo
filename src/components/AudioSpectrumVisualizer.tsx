import React, { useRef, useEffect, useState } from 'react';
import { Activity, BarChart2, Radio, Zap } from 'lucide-react';

interface AudioSpectrumVisualizerProps {
  stream?: MediaStream | null;
  isActive?: boolean;
  height?: number;
  initialMode?: 'bars' | 'waveform' | 'circular';
  showControls?: boolean;
  showMetrics?: boolean;
  accentColor?: string;
}

export const AudioSpectrumVisualizer: React.FC<AudioSpectrumVisualizerProps> = ({
  stream,
  isActive = true,
  height = 80,
  initialMode = 'bars',
  showControls = true,
  showMetrics = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visualMode, setVisualMode] = useState<'bars' | 'waveform' | 'circular'>(initialMode);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [peakFreq, setPeakFreq] = useState<number>(0);
  const [voiceClarity, setVoiceClarity] = useState<'Silêncio' | 'Voz Clara' | 'Voz Forte' | 'Ruído'>(
    'Silêncio'
  );

  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

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
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      analyser.minDecibels = -90;
      analyser.maxDecibels = -10;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      renderLoop();
    } catch (err) {
      console.error('Erro ao inicializar Web Audio Analyser:', err);
    }

    return () => {
      cleanupAudio();
    };
  }, [stream, isActive, visualMode]);

  const cleanupAudio = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setCurrentVolume(0);
    setPeakFreq(0);
    setVoiceClarity('Silêncio');
  };

  const renderLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    if (!ctx || !analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);

      // Calcular Volume (RMS) e Frequência de Pico
      let sum = 0;
      let maxVal = 0;
      let maxIdx = 0;
      for (let i = 0; i < bufferLength; i++) {
        const val = freqData[i];
        sum += val;
        if (val > maxVal) {
          maxVal = val;
          maxIdx = i;
        }
      }
      const avgVolume = sum / bufferLength;
      const volPct = Math.min(100, Math.round((avgVolume / 140) * 100));
      setCurrentVolume(volPct);

      // Frequência de pico estimada (amostragem padrão 44.1kHz ou 48kHz)
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      const freqHz = Math.round((maxIdx * sampleRate) / (analyser.fftSize * 2));
      setPeakFreq(freqHz);

      if (volPct < 5) {
        setVoiceClarity('Silêncio');
      } else if (volPct < 65) {
        setVoiceClarity('Voz Clara');
      } else if (volPct < 90) {
        setVoiceClarity('Voz Forte');
      } else {
        setVoiceClarity('Ruído');
      }

      // Preparar canvas
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Desenhar fundo sutil com gradiente
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0f172a');
      bgGrad.addColorStop(1, '#020617');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grid sutil
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let y = height / 4; y < height; y += height / 4) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();

      if (visualMode === 'bars') {
        drawFrequencyBars(ctx, width, height, freqData, bufferLength);
      } else if (visualMode === 'waveform') {
        drawWaveform(ctx, width, height, timeData, bufferLength);
      } else {
        drawCircular(ctx, width, height, freqData, bufferLength);
      }
    };

    draw();
  };

  const drawFrequencyBars = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    // Usar os primeiros 48 bins mais perceptíveis da voz humana (80Hz a ~4kHz)
    const barCount = 36;
    const barSpacing = 3;
    const totalSpacing = barSpacing * (barCount - 1);
    const barWidth = Math.max(2, (width - totalSpacing - 16) / barCount);
    const startX = (width - (barCount * barWidth + totalSpacing)) / 2;

    for (let i = 0; i < barCount; i++) {
      // Mapear bins logarítmicos
      const dataIndex = Math.min(
        bufferLength - 1,
        Math.floor(Math.pow(i / barCount, 1.4) * (bufferLength * 0.75))
      );
      const value = data[dataIndex] || 0;
      const normalizedHeight = (value / 255) * (height - 12);
      const barHeight = Math.max(3, normalizedHeight);

      const x = startX + i * (barWidth + barSpacing);
      const y = height - barHeight - 4;

      // Gradiente de cor por frequência e altura
      const gradient = ctx.createLinearGradient(0, height, 0, y);
      if (i < barCount * 0.3) {
        gradient.addColorStop(0, '#6366f1'); // Índigo (Graves)
        gradient.addColorStop(1, '#818cf8');
      } else if (i < barCount * 0.7) {
        gradient.addColorStop(0, '#10b981'); // Esmeralda (Médios da fala)
        gradient.addColorStop(1, '#34d399');
      } else {
        gradient.addColorStop(0, '#f59e0b'); // Âmbar (Agudos e formantes)
        gradient.addColorStop(1, '#fbbf24');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
      ctx.fill();

      // Ponto de pico
      if (barHeight > 8) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y - 2, barWidth, 1.5);
      }
    }
  };

  const drawWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    ctx.lineWidth = 2.5;
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#6366f1');
    gradient.addColorStop(0.5, '#10b981');
    gradient.addColorStop(1, '#f59e0b');
    ctx.strokeStyle = gradient;
    ctx.beginPath();

    const sliceWidth = (width - 20) / bufferLength;
    let x = 10;

    for (let i = 0; i < bufferLength; i++) {
      const v = data[i] / 128.0;
      const y = (v * height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(width - 10, height / 2);
    ctx.stroke();

    // Linha central de repouso
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, height / 2);
    ctx.lineTo(width - 10, height / 2);
    ctx.stroke();
  };

  const drawCircular = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    data: Uint8Array,
    bufferLength: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) * 0.45;

    ctx.save();
    ctx.translate(centerX, centerY);

    const step = (Math.PI * 2) / 32;
    for (let i = 0; i < 32; i++) {
      const val = data[i * 2] || 0;
      const barLen = Math.max(4, (val / 255) * (radius * 1.2));

      const angle = i * step;
      const x1 = Math.cos(angle) * radius;
      const y1 = Math.sin(angle) * radius;
      const x2 = Math.cos(angle) * (radius + barLen);
      const y2 = Math.sin(angle) * (radius + barLen);

      ctx.strokeStyle = i % 2 === 0 ? '#6366f1' : '#10b981';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Núcleo central pulsante com o volume
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(6, radius * 0.4 * (currentVolume / 80 + 0.3)), 0, Math.PI * 2);
    ctx.fillStyle = '#6366f1';
    ctx.fill();

    ctx.restore();
  };

  return (
    <div className="w-full bg-[oklch(0.18_0.02_260)] border border-[var(--border)] rounded-[var(--r-md)] overflow-hidden shadow-inner flex flex-col font-mono">
      {/* Header com Modos e Métricas */}
      <div className="px-3 py-2 bg-[oklch(0.14_0.02_260)] border-b border-white/10 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2">
          <span className="relative flex h-2 w-2">
            {stream && isActive ? (
              <>
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]"></span>
              </>
            ) : (
              <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
            )}
          </span>
          <span className="font-bold text-white text-[11px]">
            Espectro de Áudio & Pronúncia
          </span>
          {showMetrics && stream && isActive && (
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                voiceClarity === 'Voz Clara'
                  ? 'bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/40'
                  : voiceClarity === 'Voz Forte'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-white/10 text-white/60'
              }`}
            >
              {voiceClarity}
            </span>
          )}
        </div>

        {showControls && (
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => setVisualMode('bars')}
              title="Espectro de Barras de Frequência"
              className={`p-1 rounded-md transition cursor-pointer ${
                visualMode === 'bars'
                  ? 'bg-[var(--accent)] text-black font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('waveform')}
              title="Onda Sonora (Osciloscópio)"
              className={`p-1 rounded-md transition cursor-pointer ${
                visualMode === 'waveform'
                  ? 'bg-[var(--accent)] text-black font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVisualMode('circular')}
              title="Ressonância Radial Polar"
              className={`p-1 rounded-md transition cursor-pointer ${
                visualMode === 'circular'
                  ? 'bg-[var(--accent)] text-black font-bold'
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Área do Canvas de Renderização em Tempo Real */}
      <div className="relative w-full" style={{ height: `${height}px` }}>
        <canvas
          ref={canvasRef}
          width={500}
          height={height}
          className="w-full h-full block"
        />

        {(!stream || !isActive) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-2xs text-white/60 text-xs">
            <span className="flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Microfone aguardando fala para capturar frequências...</span>
            </span>
          </div>
        )}
      </div>

      {/* Medidor de Intensidade / Volume Inferior */}
      {showMetrics && (
        <div className="px-3 py-1.5 bg-[oklch(0.14_0.02_260)] border-t border-white/10 flex items-center justify-between text-[10px] text-white/60">
          <div className="flex items-center space-x-2 flex-1 max-w-xs">
            <span>Intensidade:</span>
            <div className="flex-1 bg-white/10 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  currentVolume > 85
                    ? 'bg-rose-500'
                    : currentVolume > 60
                    ? 'bg-amber-400'
                    : 'bg-[var(--accent)]'
                }`}
                style={{ width: `${currentVolume}%` }}
              />
            </div>
            <span className="font-mono">{currentVolume}%</span>
          </div>

          <div className="flex items-center space-x-3">
            {peakFreq > 0 && (
              <span className="font-mono text-white/80">
                Pico: <strong className="text-[var(--accent)]">{peakFreq} Hz</strong>
              </span>
            )}
            <span>80Hz - 4kHz (Faixa Vocal)</span>
          </div>
        </div>
      )}
    </div>
  );
};
