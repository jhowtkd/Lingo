import React, { useEffect, useState, useRef } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  X,
  Radio,
  Sparkles,
  Award,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  CornerDownLeft,
  Settings2,
} from 'lucide-react';
import {
  GeminiLiveVoiceService,
  LiveConnectionState,
  LiveTranscriptItem,
} from '../services/liveAudioService';
import { AchievementEngine } from '../services/achievementEngine';
import { StorageService } from '../services/storage';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';
import { TutorAudioWaveVisualizer } from './TutorAudioWaveVisualizer';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTopic: string;
  studentLevel: string;
  onSessionComplete?: (durationMin: number, transcript: LiveTranscriptItem[]) => void;
}

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  currentTopic,
  studentLevel,
  onSessionComplete,
}) => {
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<'Aoede' | 'Zephyr' | 'Puck' | 'Fenrir' | 'Kore'>('Aoede');
  const [transcripts, setTranscripts] = useState<LiveTranscriptItem[]>([]);
  const [currentVolume, setCurrentVolume] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<'user' | 'tutor' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [interruptedNotice, setInterruptedNotice] = useState(false);

  const liveServiceRef = useRef<GeminiLiveVoiceService | null>(null);
  const timerRef = useRef<any>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      startLiveSession();
    } else {
      endLiveSession();
    }

    return () => {
      endLiveSession();
    };
  }, [isOpen]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const startLiveSession = async (customVoice = selectedVoice) => {
    setErrorMessage(null);
    setTranscripts([]);
    setSessionDuration(0);
    setInterruptedNotice(false);

    if (liveServiceRef.current) {
      liveServiceRef.current.disconnect();
    }

    const service = new GeminiLiveVoiceService();
    liveServiceRef.current = service;

    service.onStateChange = (state, details) => {
      setConnectionState(state);
      if (state === 'speaking') {
        setActiveSpeaker('tutor');
        setInterruptedNotice(false);
      } else if (state === 'listening') {
        setActiveSpeaker('user');
      } else if (state === 'connected') {
        setActiveSpeaker(null);
      } else if (state === 'error' && details) {
        setErrorMessage(details);
      }
    };

    service.onVolumeLevel = (level, source) => {
      setCurrentVolume(level);
      setActiveSpeaker(source);
    };

    service.onTranscript = (item) => {
      setTranscripts((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.speaker === item.speaker && last.text === item.text) {
          return prev;
        }
        return [...prev, item];
      });
    };

    service.onError = (err) => {
      setErrorMessage(err);
    };

    try {
      await service.connect(currentTopic, studentLevel, { voice: customVoice });
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setSessionDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao iniciar microfone ou conexão.');
    }
  };

  const endLiveSession = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const finalTranscripts = [...transcripts];
    const duration = sessionDuration;

    if (liveServiceRef.current) {
      liveServiceRef.current.disconnect();
      liveServiceRef.current = null;
    }

    // Registra métricas e avalia conquistas
    if (duration > 5) {
      const minutes = Math.max(1, Math.round(duration / 60));
      StorageService.recordMinutesStudied(minutes);
      StorageService.addXP(minutes * 20 + 25);
      AchievementEngine.recordVoiceInteraction();

      // Salva turnos na conversa principal do chat se houver transcrições
      if (finalTranscripts.length > 0) {
        finalTranscripts.forEach((t) => {
          StorageService.addChatMessage({
            id: t.id,
            remetente: t.speaker === 'user' ? 'user' : 'tutor',
            conteudo: t.text,
            timestamp: t.timestamp,
          });
        });
      }

      onSessionComplete?.(minutes, finalTranscripts);
    }

    setConnectionState('idle');
  };

  const toggleMute = () => {
    if (liveServiceRef.current) {
      const nextMute = !isMuted;
      liveServiceRef.current.setMuted(nextMute);
      setIsMuted(nextMute);
    }
  };

  const handleVoiceChange = (newVoice: 'Aoede' | 'Zephyr' | 'Puck' | 'Fenrir' | 'Kore') => {
    setSelectedVoice(newVoice);
    if (isOpen) {
      startLiveSession(newVoice);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() || !liveServiceRef.current) return;

    liveServiceRef.current.sendTextMessage(textInput);
    setTranscripts((prev) => [
      ...prev,
      {
        id: `user-text-${Date.now()}`,
        speaker: 'user',
        text: textInput,
        timestamp: new Date().toISOString(),
      },
    ]);
    setTextInput('');
  };

  if (!isOpen) return null;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        id="gemini-live-modal"
      >
        <CornerPlus />

        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-raised)] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-[var(--r-sm)] bg-[var(--accent)] text-black flex items-center justify-center font-mono font-bold text-xs shadow-2xs">
              LV
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold tracking-tight text-[var(--fg)]">
                  Conversa por Voz (Gemini Live API)
                </h2>
                <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 font-mono text-[10px] font-semibold text-[var(--accent)] uppercase">
                  LIVE STREAM
                </div>
              </div>
              <p className="text-xs text-[var(--muted)] font-mono mt-0.5">
                TÓPICO: <span className="font-semibold text-[var(--fg)]">{currentTopic}</span> • NÍVEL: {studentLevel}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-[var(--r-sm)] bg-[var(--surface)] border border-[var(--border)] text-xs font-mono text-[var(--fg)]">
              <div className={`w-2 h-2 rounded-full ${connectionState === 'speaking' ? 'bg-[var(--accent)] animate-ping' : connectionState === 'listening' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
              <span>{formatTime(sessionDuration)}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-white/5 rounded-md transition cursor-pointer"
              title="Fechar conversa por voz"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visualizador de Áudio e Status Interativo */}
        <div className="p-6 bg-[var(--surface)] flex flex-col items-center justify-center border-b border-[var(--border)]">
          {activeSpeaker === 'tutor' || connectionState === 'speaking' ? (
            <div className="w-full max-w-md my-1">
              <TutorAudioWaveVisualizer
                isPlaying={true}
                height={70}
                voiceName={selectedVoice}
                showControls={false}
                showMetrics={true}
                showModeSwitcher={false}
              />
            </div>
          ) : (
            /* Ondas sonoras animadas com base no volume */
            <div className="h-20 flex items-center justify-center space-x-1.5 w-full max-w-xs my-2">
              {[40, 65, 85, 100, 75, 90, 50, 80, 95, 60, 45].map((baseHeight, i) => {
                const dynamicHeight = Math.max(
                  12,
                  Math.min(76, (baseHeight * (currentVolume + 15)) / 75)
                );
                return (
                  <div
                    key={i}
                    className={`w-2 rounded-full transition-all duration-75 ${
                      activeSpeaker === 'user'
                        ? 'bg-[var(--accent)]'
                        : 'bg-white/15'
                    }`}
                    style={{ height: `${dynamicHeight}px` }}
                  />
                );
              })}
            </div>
          )}

          {/* Status textual */}
          <div className="text-center mt-2 flex flex-col items-center gap-1.5 font-mono">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                connectionState === 'speaking'
                  ? 'bg-[var(--surface-raised)] text-[var(--fg)] border-[var(--border)]'
                  : connectionState === 'listening'
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30'
                  : connectionState === 'connecting'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : 'bg-[var(--surface-raised)] text-[var(--muted)] border-[var(--border)]'
              }`}
            >
              <Activity className="w-3.5 h-3.5 animate-spin" />
              {connectionState === 'speaking' && 'Tutor falando... (Você pode interromper a qualquer momento)'}
              {connectionState === 'listening' && 'Ouvindo você... Fale naturalmente no microfone'}
              {connectionState === 'connecting' && 'Conectando ao modelo Gemini Live...'}
              {connectionState === 'connected' && 'Pronto para conversar. Diga algo ou pergunte!'}
              {connectionState === 'error' && 'Aviso de conexão'}
            </span>

            {interruptedNotice && (
              <span className="text-[11px] font-medium text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                ⚡ Interrupção natural detectada — tutor ouviu sua fala.
              </span>
            )}
          </div>

          {errorMessage && (
            <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-[var(--r-sm)] flex items-center space-x-2 font-mono">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>

        {/* Histórico da Transcrição ao Vivo */}
        <div className="flex-1 p-5 overflow-y-auto space-y-3 min-h-[220px] max-h-[300px] bg-black/20 text-sm font-sans">
          {transcripts.length === 0 ? (
            <div className="text-center py-8 text-[var(--muted)] text-xs font-mono space-y-1">
              <p>O fluxo de transcrição em tempo real aparecerá aqui conforme você e o tutor conversam.</p>
              <p className="text-[11px]">Dica: fale com clareza ou faça uma pergunta sobre {currentTopic}.</p>
            </div>
          ) : (
            transcripts.map((item) => (
              <div
                key={item.id}
                className={`flex flex-col ${
                  item.speaker === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div className="flex items-center space-x-1.5 mb-1 px-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)]">
                    {item.speaker === 'user' ? 'Você' : 'Tutor (Gemini Live)'}
                  </span>
                </div>
                <div
                  className={`p-3 rounded-[var(--r-md)] max-w-[85%] leading-relaxed ${
                    item.speaker === 'user'
                      ? 'bg-[var(--accent)] text-black font-medium shadow-2xs'
                      : 'bg-[var(--surface-raised)] border border-[var(--border)] text-[var(--fg)] shadow-2xs'
                  }`}
                >
                  {item.text}
                </div>
              </div>
            ))
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Barra de Seleção de Voz e Entrada de Texto */}
        <div className="p-3 bg-[var(--surface)] border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-1.5 text-xs text-[var(--muted)] font-mono">
            <Settings2 className="w-3.5 h-3.5 text-[var(--muted)]" />
            <span>VOZ:</span>
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value as any)}
              className="bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--r-sm)] px-2 py-1 text-xs font-medium text-[var(--fg)] focus:outline-none cursor-pointer"
            >
              <option value="Aoede">Aoede (Feminina)</option>
              <option value="Zephyr">Zephyr (Masculina)</option>
              <option value="Puck">Puck (Jovem)</option>
              <option value="Fenrir">Fenrir (Firme)</option>
              <option value="Kore">Kore (Calma)</option>
            </select>
          </div>

          <form onSubmit={handleSendText} className="flex gap-2 flex-1 sm:flex-initial sm:min-w-[260px]">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enviar texto alternativo..."
              className="flex-1 px-3 py-1.5 text-xs bg-[var(--surface-raised)] border border-[var(--border)] rounded-[var(--r-sm)] focus:outline-none focus:border-[var(--accent)] text-[var(--fg)]"
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={!textInput.trim()}
              className="font-mono text-xs gap-1 cursor-pointer"
            >
              <span>Enviar</span>
              <CornerDownLeft className="w-3 h-3" />
            </Button>
          </form>
        </div>

        {/* Barra de Controles Inferiores */}
        <div className="px-6 py-3.5 bg-[var(--surface-raised)] border-t border-[var(--border)] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant={isMuted ? 'outline' : 'default'}
              size="sm"
              onClick={toggleMute}
              className={`gap-2 font-mono text-xs cursor-pointer ${
                isMuted ? 'border-rose-500/40 text-rose-400 bg-rose-500/10' : ''
              }`}
            >
              {isMuted ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
              <span>{isMuted ? 'Desmutar Microfone' : 'Microfone Ativo'}</span>
            </Button>
          </div>

          <div className="flex items-center space-x-3">
            <span className="text-[11px] font-mono text-[var(--muted)] hidden sm:inline">
              +20 XP/MINUTO CONVERSAÇÃO
            </span>
            <Button
              size="sm"
              onClick={onClose}
              className="gap-1.5 font-mono text-xs cursor-pointer shadow-2xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Concluir e Salvar</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
