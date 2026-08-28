import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Mic,
  MicOff,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Radio,
  Sliders,
  Brain,
  Trash2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Volume2,
  VolumeX,
  Play,
  Square,
  Sparkle,
  Headphones,
  Ear,
  Activity,
  BarChart2,
  Gauge,
  Timer,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ChatMessage,
  PedagogicalCorrection,
  UserStats,
  ExplanationAdaptation,
  PronunciationScoreData,
  CEFRLevel,
  SpeechRateMetrics,
} from '../types';
import { StorageService } from '../services/storage';
import { GraphEngine } from '../services/graphEngine';
import { AudioRecorderService } from '../services/audioService';
import { AchievementEngine } from '../services/achievementEngine';
import { SpeechService, NEURAL_VOICES } from '../services/speechSynthesisService';
import {
  SpeechRateService,
  CEFR_SPEECH_RATE_TARGETS,
} from '../services/speechRateService';
import { LiveVoiceModal } from './LiveVoiceModal';
import { PronunciationPracticeModal } from './PronunciationPracticeModal';
import { PronunciationScoreCard } from './PronunciationScoreCard';
import { SpeechRateVisualizer } from './SpeechRateVisualizer';
import { SpeechRateCoachModal } from './SpeechRateCoachModal';
import { AudioSpectrumVisualizer } from './AudioSpectrumVisualizer';
import { TutorVoiceWaveform } from './TutorVoiceWaveform';
import { CornerPlus } from './ui/corner-plus';
import { BorderTrail } from './ui/border-trail';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SectionHeader } from './ui/section-header';

interface ChatTutorProps {
  currentTopic: string;
  stats: UserStats;
  onUpdateStats: (newStats: UserStats) => void;
  onSelectTopic: (topic: string) => void;
}

export const ChatTutor: React.FC<ChatTutorProps> = ({
  currentTopic,
  stats,
  onUpdateStats,
  onSelectTopic,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentLevel, setStudentLevel] = useState<'Iniciante' | 'Intermediário' | 'Avançado'>(
    'Intermediário'
  );
  const [adaptationPreference, setAdaptationPreference] = useState<
    'auto' | 'fundamental_analogico' | 'intermediario_aplicado' | 'avancado_analitico'
  >('auto');

  // Modo 'Ouvir Apenas' (Treinamento Auditivo & Ondas Sonoras)
  const [isListenOnlyMode, setIsListenOnlyMode] = useState(false);

  // Modal Gemini Live
  const [isLiveModalOpen, setIsLiveModalOpen] = useState(false);
  // Modal de Prática de Pronúncia & Análise Espectral
  const [isPronunciationModalOpen, setIsPronunciationModalOpen] = useState(false);

  // Estados de Gravação de Voz simples (Single Shot)
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [reviewVoiceText, setReviewVoiceText] = useState<string | null>(null);
  const [reviewVoiceAudioBase64, setReviewVoiceAudioBase64] = useState<string | null>(null);
  const [reviewVoiceMimeType, setReviewVoiceMimeType] = useState<string>('audio/webm');
  const [reviewVoiceDuration, setReviewVoiceDuration] = useState<number>(0);
  const [isSpeechRateCoachOpen, setIsSpeechRateCoachOpen] = useState(false);
  const [evaluatingPronunciationMsgId, setEvaluatingPronunciationMsgId] = useState<string | null>(
    null
  );

  // Estados de Confirmação de Aprendizagem
  const [answeringCorrectionId, setAnsweringCorrectionId] = useState<string | null>(null);
  const [confirmationAnswer, setConfirmationAnswer] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // Estados de Reprodução de Áudio e Voz Natural
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [speechSpeed, setSpeechSpeed] = useState<number>(0.88);
  const [selectedVoice, setSelectedVoice] = useState<string>(SpeechService.getPreferredVoice());
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  // Expandir detalhes de adaptação
  const [expandedAdaptationId, setExpandedAdaptationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);
  const timerIntervalRef = useRef<any>(null);

  useEffect(() => {
    setMessages(StorageService.getChatHistory());
    audioRecorderRef.current = new AudioRecorderService();

    // Inscreve no serviço de síntese de voz
    const unsubscribeSpeech = SpeechService.subscribe((isPlaying, id) => {
      setPlayingAudioId(isPlaying ? id : null);
    });

    // Avalia conquistas ao iniciar
    const evalRes = AchievementEngine.evaluateAll();
    if (evalRes.newlyUnlocked.length > 0) {
      onUpdateStats(StorageService.getStats());
    }

    return () => {
      unsubscribeSpeech();
      SpeechService.stop();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, reviewVoiceText]);

  // Envio de mensagem com suporte a áudio, score de pronúncia e taxa de fala
  const handleSendMessage = async (
    textToSend?: string,
    options?: {
      isAudio?: boolean;
      audioBase64?: string;
      mimeType?: string;
      durationSeconds?: number;
      pronunciationScore?: PronunciationScoreData;
    }
  ) => {
    const content = (textToSend || inputText).trim();
    if (!content || isLoading) return;

    setInputText('');
    setReviewVoiceText(null);
    setReviewVoiceAudioBase64(null);
    setAudioError(null);

    const isAudioMsg = !!(options?.isAudio || options?.audioBase64 || options?.durationSeconds);
    const duration =
      options?.durationSeconds ||
      reviewVoiceDuration ||
      (isAudioMsg ? Math.max(1, recordingTime) : 0);

    const cefr = SpeechRateService.mapStudentLevelToCEFR(studentLevel);
    const calculatedSpeechRate =
      isAudioMsg && duration > 0
        ? SpeechRateService.calculateSpeechRate(content, duration, cefr)
        : options?.pronunciationScore?.speech_rate;

    const userMsgId = `msg-${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      remetente: 'user',
      conteudo: content,
      timestamp: new Date().toISOString(),
      pronunciation_score: options?.pronunciationScore,
      speech_rate: calculatedSpeechRate,
      is_audio_response: isAudioMsg,
    };

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    StorageService.addChatMessage(userMsg);
    setIsLoading(true);

    // Se foi resposta falada e ainda não tem score calculado, dispara avaliação fonética em segundo plano
    if (isAudioMsg && !options?.pronunciationScore) {
      handleRequestPronunciationScore(userMsgId, content, options?.audioBase64, duration);
    }

    try {
      // 1. Recupera memórias contextuais relevantes do grafo e analisa adaptação recomendada
      const graphContext = GraphEngine.getRelevantContext(currentTopic, content, 5);
      const recentCorrections = StorageService.getCorrections().slice(0, 3);
      const computedAdaptation = GraphEngine.analyzeStudentComprehension(currentTopic, content);

      // 2. Chama a API do Tutor Pedagógico
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: content,
          historico: updatedMessages.map((m) => ({
            role: m.remetente === 'user' ? 'user' : 'model',
            content: m.conteudo,
          })),
          topico_atual: currentTopic,
          nivel_estudante: studentLevel,
          contexto_grafo: graphContext,
          correcoes_recentes: recentCorrections,
          preferencia_adaptacao:
            adaptationPreference !== 'auto' ? adaptationPreference : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error(`Erro na resposta do servidor: ${res.status}`);
      }

      const data = await res.json();

      // 3. Processa nós novos ou atualizados no Grafo
      if (data.novos_nos_grafo && data.novos_nos_grafo.length > 0) {
        GraphEngine.processNewNodesFromTutor(data.novos_nos_grafo, content);
      }

      // 4. Registra adaptação nos nós do grafo para rastreabilidade
      const effectiveAdaptation: ExplanationAdaptation = data.adaptacao || computedAdaptation;
      GraphEngine.recordAdaptationUsed(currentTopic, effectiveAdaptation);

      // 5. Registra correção pedagógica estruturada, se houver
      let pedagogicalCorrection: PedagogicalCorrection | undefined = undefined;
      if (data.possui_erro && data.correcao) {
        pedagogicalCorrection = {
          id: `corr-${Date.now()}`,
          conceito: data.correcao.conceito || currentTopic,
          erro: data.correcao.erro || 'Equívoco conceitual identificado',
          explicacao: data.correcao.explicacao || 'Explicação detalhada',
          resposta_corrigida: data.correcao.resposta_corrigida || 'Forma correta',
          gravidade: data.correcao.gravidade || 'moderada',
          data: new Date().toISOString(),
          evidencia: data.correcao.evidencia || content,
          estado_posterior: 'pendente',
          pergunta_confirmacao: data.correcao.pergunta_confirmacao,
          respondido_corretamente: false,
        };
        StorageService.addCorrection(pedagogicalCorrection);
      }

      // 6. Atribui XP e atualiza gamificação
      const xpAmount = data.xp_ganho || (data.possui_erro ? 15 : 25);
      const xpResult = StorageService.addXP(xpAmount);
      StorageService.recordAnswer(!data.possui_erro);
      StorageService.recordMinutesStudied(3); // 3 minutos de estudo ativo por interação
      onUpdateStats(xpResult.stats);

      // Avalia conquistas desbloqueadas
      const evalRes = AchievementEngine.evaluateAll();
      if (evalRes.newlyUnlocked.length > 0) {
        onUpdateStats(StorageService.getStats());
      }

      if (xpResult.subiu_nivel) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      }

      // 7. Mensagem de resposta do Tutor com Metadados de Adaptação
      const tutorMsg: ChatMessage = {
        id: `tutor-${Date.now()}`,
        remetente: 'tutor',
        conteudo: data.resposta_tutor,
        timestamp: new Date().toISOString(),
        correcao: pedagogicalCorrection,
        conceitos_chave: data.conceitos_chave,
        xp_ganho: xpAmount,
        adaptacao: effectiveAdaptation,
      };

      const finalMessages = [...updatedMessages, tutorMsg];
      setMessages(finalMessages);
      StorageService.addChatMessage(tutorMsg);

      // Se o usuário está no modo Ouvir Apenas, auto-reproduz com foco auditivo
      if (isListenOnlyMode && data.resposta_tutor) {
        handlePlayPhraseAudio(tutorMsg.id, data.resposta_tutor, 'en-US');
      }
    } catch (err: any) {
      console.error('Erro ao enviar mensagem:', err);
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        remetente: 'system',
        conteudo:
          'Não foi possível conectar ao servidor no momento. Por favor, tente novamente ou verifique a conexão.',
        timestamp: new Date().toISOString(),
      };
      setMessages([...updatedMessages, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Avaliação Dinâmica de Pronúncia Fonética, IPA e Taxa de Fala
  const handleRequestPronunciationScore = async (
    msgId: string,
    text: string,
    audioBase64?: string,
    duration?: number
  ) => {
    setEvaluatingPronunciationMsgId(msgId);
    try {
      const res = await fetch('/api/pronunciation-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texto_falado: text,
          audio_base64: audioBase64,
          idioma: 'Inglês',
          topico: currentTopic,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.scoreData) {
          const cefr = SpeechRateService.mapStudentLevelToCEFR(studentLevel);
          const safeDuration =
            duration || data.scoreData.audio_duration_seconds || reviewVoiceDuration || 2;
          const calculatedRate = SpeechRateService.calculateSpeechRate(text, safeDuration, cefr);
          const enrichedScore: PronunciationScoreData = {
            ...data.scoreData,
            audio_duration_seconds: safeDuration,
            speech_rate: calculatedRate,
          };

          setMessages((prev) =>
            prev.map((m) =>
              m.id === msgId
                ? {
                    ...m,
                    pronunciation_score: enrichedScore,
                    speech_rate: m.speech_rate || calculatedRate,
                  }
                : m
            )
          );
          StorageService.updateChatMessage(msgId, {
            pronunciation_score: enrichedScore,
            speech_rate: calculatedRate,
          });
          const xpRes = StorageService.addXP(25);
          onUpdateStats(xpRes.stats);
        }
      }
    } catch (err) {
      console.warn('Erro ao avaliar pronúncia:', err);
    } finally {
      setEvaluatingPronunciationMsgId(null);
    }
  };

  const handleToggleListenOnly = () => {
    setIsListenOnlyMode((prev) => {
      const next = !prev;
      if (next && isRecording) {
        handleCancelRecording();
      }
      return next;
    });
  };

  // Gravação de Áudio com MediaRecorder
  const handleStartRecording = async () => {
    if (isListenOnlyMode) return;
    setAudioError(null);
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorderService();
      }
      await audioRecorderRef.current.startRecording();
      setIsRecording(true);
      setRecordingStream(audioRecorderRef.current.getStream());
      setRecordingTime(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      setAudioError(
        'Permissão de microfone negada ou indisponível. Verifique as configurações do navegador.'
      );
      setIsRecording(false);
      setRecordingStream(null);
    }
  };

  const handleStopRecording = async () => {
    if (!audioRecorderRef.current || !isRecording) return;

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    const finalRecTime = recordingTime;
    setIsRecording(false);
    setRecordingStream(null);
    setTranscribing(true);
    setAudioError(null);

    try {
      const result = await audioRecorderRef.current.stopRecordingAndTranscribe('pt-BR');
      if (result.text && result.text.trim()) {
        const measuredDuration = result.durationSeconds || Math.max(1, finalRecTime);
        setReviewVoiceDuration(measuredDuration);
        setReviewVoiceText(result.text.trim());
        setReviewVoiceAudioBase64(result.audioBase64 || null);
        setReviewVoiceMimeType(result.mimeType || 'audio/webm');
        AchievementEngine.recordVoiceInteraction();
        onUpdateStats(StorageService.getStats());
      } else {
        setAudioError('Não foi possível identificar fala clara no áudio gravado.');
      }
    } catch (err: any) {
      setAudioError(err.message || 'Falha ao transcrever o áudio.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancelRecording();
    }
    setIsRecording(false);
    setRecordingStream(null);
    setRecordingTime(0);
    setAudioError(null);
  };

  // Resposta à checagem imediata de aprendizagem
  const handleConfirmLearning = async (correction: PedagogicalCorrection) => {
    if (!confirmationAnswer.trim()) return;

    const answer = confirmationAnswer.trim();
    setConfirmationAnswer('');
    setAnsweringCorrectionId(null);

    const userFollowUp: ChatMessage = {
      id: `confirm-ans-${Date.now()}`,
      remetente: 'user',
      conteudo: `[Checagem de Aprendizagem]: ${answer}`,
      timestamp: new Date().toISOString(),
    };

    const newMsgs = [...messages, userFollowUp];
    setMessages(newMsgs);
    StorageService.addChatMessage(userFollowUp);

    // Valida com o tutor
    setIsLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensagem: `O estudante respondeu à pergunta de checagem do conceito "${correction.conceito}": "${answer}". A pergunta era: "${correction.pergunta_confirmacao}". Avalie se ele compreendeu o conceito corretamente.`,
          topico_atual: currentTopic,
          nivel_estudante: studentLevel,
        }),
      });

      const data = await res.json();
      const acertou = !data.possui_erro;

      // Atualiza o estado da correção
      StorageService.updateCorrectionStatus(
        correction.id,
        acertou ? 'compreendido' : 'precisa_revisar',
        acertou
      );

      if (acertou) {
        StorageService.addXP(40);
        onUpdateStats(StorageService.getStats());
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
        });
      }

      // Avalia conquistas (especialmente Detetive de Erros)
      AchievementEngine.evaluateAll();
      onUpdateStats(StorageService.getStats());

      const tutorConfirmMsg: ChatMessage = {
        id: `tutor-conf-${Date.now()}`,
        remetente: 'tutor',
        conteudo: data.resposta_tutor,
        timestamp: new Date().toISOString(),
        xp_ganho: acertou ? 40 : 10,
        adaptacao: data.adaptacao,
      };

      setMessages([...newMsgs, tutorConfirmMsg]);
      StorageService.addChatMessage(tutorConfirmMsg);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Tem certeza que deseja limpar o histórico desta conversa?')) {
      StorageService.clearChatHistory();
      setMessages([]);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleMessageAudio = async (msgId: string, text: string) => {
    if (playingAudioId === msgId) {
      SpeechService.stop();
      setPlayingAudioId(null);
    } else {
      setIsVoiceLoading(true);
      try {
        await SpeechService.speak(
          text,
          {
            voice: selectedVoice,
            rate: speechSpeed,
            useNeuralAI: true,
            onEnd: () => setIsVoiceLoading(false),
            onError: () => setIsVoiceLoading(false),
          },
          msgId
        );
      } finally {
        setIsVoiceLoading(false);
      }
    }
  };

  const handlePlayPhraseAudio = async (phraseId: string, phrase: string, lang = 'en-US') => {
    if (playingAudioId === phraseId) {
      SpeechService.stop();
      setPlayingAudioId(null);
    } else {
      setIsVoiceLoading(true);
      try {
        await SpeechService.speak(
          phrase,
          {
            lang,
            voice: selectedVoice,
            rate: speechSpeed,
            useNeuralAI: true,
            onEnd: () => setIsVoiceLoading(false),
            onError: () => setIsVoiceLoading(false),
          },
          phraseId
        );
      } finally {
        setIsVoiceLoading(false);
      }
    }
  };

  const handleVoiceChange = (newVoice: string) => {
    setSelectedVoice(newVoice);
    SpeechService.setPreferredVoice(newVoice);
    if (playingAudioId) {
      SpeechService.stop();
      setPlayingAudioId(null);
    }
  };

  const handleStopAudio = () => {
    SpeechService.stop();
    setPlayingAudioId(null);
    setIsVoiceLoading(false);
  };

  const quickPrompts = [
    `Simule um diálogo casual de roleplay sobre ${currentTopic}`,
    `Quais falsos cognatos e erros de tradução ocorrem em ${currentTopic}?`,
    `Me dê 3 phrasal verbs ou expressões naturais sobre ${currentTopic}`,
    `Faça uma pergunta desafiadora em inglês para testar minha resposta`,
  ];

  // Coleta todas as métricas de taxa de fala das mensagens faladas do usuário na sessão
  const allSpokenMetrics: SpeechRateMetrics[] = messages
    .filter(
      (m) =>
        m.remetente === 'user' && (m.speech_rate || m.pronunciation_score?.speech_rate)
    )
    .map((m) => (m.speech_rate || m.pronunciation_score?.speech_rate)!)
    .filter(Boolean);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] max-w-5xl w-full mx-auto p-2 sm:p-4">
      {/* Modal Gemini Live */}
      <LiveVoiceModal
        isOpen={isLiveModalOpen}
        onClose={() => {
          setIsLiveModalOpen(false);
          const updatedStats = StorageService.getStats();
          onUpdateStats(updatedStats);
          setMessages(StorageService.getChatHistory());
        }}
        onSessionComplete={(mins) => {
          if (mins > 0) {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.7 },
            });
          }
        }}
        currentTopic={currentTopic}
        studentLevel={studentLevel}
      />

      {/* Modal Treinador de Taxa de Fala & Ritmo (WPM) */}
      <SpeechRateCoachModal
        isOpen={isSpeechRateCoachOpen}
        onClose={() => setIsSpeechRateCoachOpen(false)}
        studentLevel={studentLevel}
        allSpokenMetrics={allSpokenMetrics}
      />

      {/* Barra Superior do Chat */}
      <div className="relative bg-card border border-border/80 rounded-2xl p-3.5 sm:p-4 mb-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shadow-xs">
            CT
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Estúdio de Conversação & Fluência
              </h2>
              <div className="inline-flex items-center rounded-full border border-border/80 bg-secondary px-2.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground uppercase">
                GRAPH ACTIVE
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-semibold text-muted-foreground/80">TÓPICO:</span>{' '}
              <span className="font-semibold text-foreground">{currentTopic}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Botão de Destaque: Treinador de Taxa de Fala / Pacing Coach */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSpeechRateCoachOpen(true)}
            className="gap-1.5 text-xs font-bold cursor-pointer rounded-[9px]"
            title="Abrir treinador e medidor de taxa de fala (palavras por minuto)"
          >
            <Gauge className="w-3.5 h-3.5 text-[#171719]" />
            <span className="hidden sm:inline">Taxa de Fala (WPM)</span>
            <span className="sm:hidden">WPM</span>
          </Button>

          {/* Botão de Modo Ouvir Apenas (Treinamento Auditivo & Onda Sonora) */}
          <Button
            variant={isListenOnlyMode ? 'accent' : 'outline'}
            size="sm"
            onClick={handleToggleListenOnly}
            className="gap-1.5 text-xs font-bold cursor-pointer rounded-[9px]"
            title="Ativar/desativar modo de treino auditivo (pausa microfone e foca na escuta e ondas sonoras)"
          >
            <Headphones className={`w-3.5 h-3.5 ${isListenOnlyMode ? 'animate-bounce text-[#171719]' : 'text-[#171719]'}`} />
            <span className="hidden sm:inline">
              {isListenOnlyMode ? 'Ouvir Apenas: ATIVO' : 'Modo Ouvir Apenas'}
            </span>
            <span className="sm:hidden">{isListenOnlyMode ? 'Ouvir ON' : 'Ouvir'}</span>
          </Button>

          {/* Botão de Destaque: Treino de Pronúncia & Espectro de Áudio */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPronunciationModalOpen(true)}
            className="gap-1.5 text-xs font-bold cursor-pointer rounded-[9px]"
            title="Praticar pronúncia com visualizador de espectro de áudio em tempo real"
          >
            <Mic className="w-3.5 h-3.5 text-[#171719]" />
            <span className="hidden sm:inline">Treino de Pronúncia</span>
            <span className="sm:hidden">Pronúncia</span>
          </Button>

          {/* Botão de Destaque: Gemini Live Voice */}
          <Button
            size="sm"
            variant="dark"
            onClick={() => setIsLiveModalOpen(true)}
            className="gap-1.5 text-xs font-bold cursor-pointer rounded-[9px]"
            title="Iniciar conversa por voz em tempo real com o Gemini Live API"
          >
            <Radio className="w-3.5 h-3.5 animate-pulse text-[#1ff98c]" />
            <span>Voz Live (API)</span>
          </Button>

          {/* Seletor de Modo de Adaptação Dinâmica */}
          <div className="flex items-center space-x-1.5 bg-[#ededed] border border-[#171719]/10 px-2.5 py-1 rounded-[9px] text-xs">
            <Sliders className="w-3 h-3 text-[#171719]" />
            <span className="text-[#171719]/70 font-bold text-[10px] uppercase hidden lg:inline">ADAPTAÇÃO:</span>
            <select
              value={adaptationPreference}
              onChange={(e) => setAdaptationPreference(e.target.value as any)}
              className="bg-transparent font-bold text-[#171719] focus:outline-none cursor-pointer text-xs"
              title="Calibração da complexidade pedagógica"
            >
              <option value="auto">🧠 Auto (Grafo)</option>
              <option value="fundamental_analogico">🌱 Fundamental</option>
              <option value="intermediario_aplicado">⚡ Intermediário</option>
              <option value="avancado_analitico">🔬 Avançado</option>
            </select>
          </div>

          {/* Seletor de Voz Neural IA (Gemini 3.1 Flash TTS) */}
          <div className="flex items-center space-x-1.5 bg-[#ededed] border border-[#171719]/10 px-2.5 py-1 rounded-[9px] text-xs">
            <Volume2 className="w-3 h-3 text-[#171719]" />
            <span className="text-[#171719]/70 font-bold text-[10px] uppercase hidden md:inline">VOZ IA:</span>
            <select
              value={selectedVoice}
              onChange={(e) => handleVoiceChange(e.target.value)}
              className="bg-transparent font-bold text-[#171719] focus:outline-none cursor-pointer text-xs"
              title="Selecione a persona de voz neural do Gemini para reprodução hiper-realista"
            >
              {NEURAL_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-white text-[#171719]">
                  ✨ {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Limpar Histórico */}
          <button
            onClick={handleClearHistory}
            className="p-2 text-[#71717a] hover:text-[#171719] hover:bg-[#ededed] rounded-[9px] border border-transparent hover:border-[#171719]/10 transition cursor-pointer"
            title="Limpar histórico da conversa"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Painel Central de Mensagens */}
      <div className="relative flex-1 bg-white border border-[#171719]/10 rounded-[25px] p-4 sm:p-6 overflow-y-auto space-y-4 shadow-sm overflow-hidden flex flex-col">
        <CornerPlus />
        {(isLoading || isRecording) && (
          <BorderTrail
            style={{
              boxShadow:
                '0px 0px 60px 30px rgba(31, 249, 140, 0.4), 0 0 100px 60px rgba(8, 186, 97, 0.3)',
            }}
            size={100}
          />
        )}

        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-[14px] bg-[#1ff98c] border border-[#171719]/20 flex items-center justify-center text-[#171719] shadow-sm">
              <Sparkles className="w-6 h-6 text-[#171719]" />
            </div>
            <div className="max-w-md space-y-1.5">
              <div className="inline-flex items-center rounded-full border border-[#171719]/15 bg-[#ededed] px-3 py-0.5 font-mono text-[10px] font-bold text-[#171719] uppercase tracking-wider">
                ACTIVE LEARNING SESSION
              </div>
              <h3 className="text-lg font-extrabold tracking-tight text-[#171719]">
                Pronto para iniciar sua sessão de aprendizado ativo!
              </h3>
              <p className="text-xs text-[#71717a] leading-relaxed">
                Converse com o tutor por texto ou voz. Suas dúvidas, equívocos e domínios serão
                mapeados dinamicamente no seu Grafo de Conhecimento.
              </p>
            </div>

            <div className="w-full max-w-lg pt-2 space-y-3">
              {/* Card de Ação Rápida: Gemini Live */}
              <div className="relative p-4 bg-[#ededed] border border-[#171719]/10 rounded-[20px] flex items-center justify-between shadow-xs gap-3">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-9 h-9 rounded-[9px] bg-[#171719] text-[#1ff98c] flex items-center justify-center shrink-0">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#171719]">
                      Prática Conversacional em Tempo Real
                    </h4>
                    <p className="text-[11px] text-[#71717a]">
                      Converse por voz com o tutor (Gemini Live API) com baixa latência e fala bidirecional.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setIsLiveModalOpen(true)}
                  className="font-bold text-xs shrink-0 cursor-pointer"
                >
                  Falar Agora
                </Button>
              </div>

              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#71717a] block mb-2 text-center">
                Ou escolha uma sugestão rápida de prompt:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 rounded-[9px] bg-white hover:bg-[#ededed] border border-[#171719]/15 text-xs text-[#171719] font-medium transition-all flex items-center justify-between group shadow-xs cursor-pointer"
                  >
                    <span className="truncate mr-2 font-mono text-[11px]">{prompt}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[#71717a] group-hover:text-[#171719] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.remetente === 'user';
          const isSystem = msg.remetente === 'system';

          if (isSystem) {
            return (
              <div
                key={msg.id}
                className="max-w-md mx-auto my-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-600 dark:text-rose-400 text-xs text-center flex items-center justify-center space-x-2 font-mono"
              >
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{msg.conteudo}</span>
              </div>
            );
          }

          const isAdaptationExpanded = expandedAdaptationId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-8 h-8 rounded-[9px] bg-[#171719] text-[#1ff98c] flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 shadow-xs border border-[#171719]/20">
                  AI
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-[20px] p-4 sm:p-4.5 shadow-xs transition-all ${
                  isUser
                    ? 'bg-[#08ba61] text-white rounded-tr-[4px] border border-[#08ba61]'
                    : 'bg-[#ededed] text-[#171719] rounded-tl-[4px] border border-[#171719]/10'
                }`}
              >
                {/* Remetente & Badge XP */}
                <div className="flex items-center justify-between text-[11px] mb-2 space-x-2">
                  <span className={`font-bold tracking-tight ${isUser ? 'text-white' : 'text-[#171719]'}`}>
                    {isUser ? 'Você' : 'Tutor de Línguas'}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {!isUser && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleMessageAudio(msg.id, msg.conteudo)}
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer border ${
                            playingAudioId === msg.id
                              ? 'bg-[#171719] text-[#1ff98c] border-[#171719] shadow-xs animate-pulse'
                              : isVoiceLoading && playingAudioId === msg.id
                              ? 'bg-white text-[#171719] border-[#171719]/20 animate-pulse'
                              : 'bg-white text-[#171719] hover:bg-[#ededed] border-[#171719]/15'
                          }`}
                          title={
                            playingAudioId === msg.id
                              ? 'Parar reprodução de voz'
                              : `Ouvir com voz neural natural (${selectedVoice})`
                          }
                        >
                          {playingAudioId === msg.id ? (
                            <>
                              <Square className="w-3 h-3 fill-current" />
                              <span>PARAR</span>
                              <span className="flex h-1.5 w-1.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1ff98c] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#1ff98c]"></span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-[#171719]" />
                              <span>Ouvir ({selectedVoice})</span>
                            </>
                          )}
                        </button>

                        {/* Seletor de velocidade rápida (0.85x / 1.0x) */}
                        <button
                          onClick={() => setSpeechSpeed((prev) => (prev === 0.88 ? 1.0 : 0.88))}
                          className="px-1 py-0.5 rounded text-[9px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-border/60 transition cursor-pointer"
                          title="Alternar velocidade de fala (0.85x mais lento para aprendizado / 1.0x normal)"
                        >
                          {speechSpeed === 0.88 ? '0.85x' : '1.0x'}
                        </button>
                      </div>
                    )}
                    {msg.xp_ganho && (
                      <span className="px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-bold text-foreground">
                        +{msg.xp_ganho} XP
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Badge de Adaptação Dinâmica de Explicação (Tutor) */}
                {!isUser && msg.adaptacao && (
                  <div className="mb-2.5">
                    <button
                      onClick={() =>
                        setExpandedAdaptationId(isAdaptationExpanded ? null : msg.id)
                      }
                      className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded border border-border bg-background text-[10px] font-mono text-foreground hover:bg-muted transition cursor-pointer"
                      title="Clique para ver como o Grafo de Memória guiou a adaptação desta explicação"
                    >
                      <Brain className="w-3 h-3 text-foreground shrink-0" />
                      <span>
                        ADAPTAÇÃO: <strong>{msg.adaptacao.rotulo}</strong>
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-foreground font-bold">
                        {msg.adaptacao.dominio_avaliado}% DOMÍNIO
                      </span>
                      {isAdaptationExpanded ? (
                        <ChevronUp className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      )}
                    </button>

                    {/* Detalhes expandidos da calibração do grafo */}
                    {isAdaptationExpanded && (
                      <div className="mt-1.5 p-3 rounded-lg bg-background border border-border text-xs text-foreground space-y-1.5 shadow-2xs font-mono">
                        <div className="flex items-start gap-1.5">
                          <Info className="w-3.5 h-3.5 text-foreground mt-0.5 shrink-0" />
                          <div>
                            <p className="font-bold text-foreground">
                              Justificativa do Grafo de Memória:
                            </p>
                            <p className="text-muted-foreground text-[11px] font-sans">{msg.adaptacao.justificativa}</p>
                          </div>
                        </div>
                        <div className="border-t border-border pt-1 text-[11px]">
                          <span className="font-bold text-foreground">Estratégia aplicada:</span>{' '}
                          <span className="text-muted-foreground font-sans">{msg.adaptacao.estrategia_pedagogica}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Conteúdo da mensagem */}
                <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                  {msg.conteudo}
                </div>

                {/* Ações & Avaliação de Pronúncia para Mensagens do Usuário */}
                {isUser && (
                  <div className="mt-2 pt-1.5 border-t border-background/20 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
                    <div className="flex items-center space-x-1.5 opacity-80">
                      {msg.is_audio_response && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-background/20 font-semibold">
                          <Mic className="w-2.5 h-2.5" /> Áudio
                        </span>
                      )}
                      {msg.speech_rate && (
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-background/20 font-bold">
                          <Gauge className="w-2.5 h-2.5" /> {msg.speech_rate.wpm} PPM
                        </span>
                      )}
                    </div>

                    {!msg.pronunciation_score && (
                      <button
                        onClick={() =>
                          handleRequestPronunciationScore(
                            msg.id,
                            msg.conteudo,
                            undefined,
                            msg.speech_rate?.durationSeconds
                          )
                        }
                        disabled={evaluatingPronunciationMsgId === msg.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-background/15 hover:bg-background/25 transition cursor-pointer text-[10px] font-bold text-background disabled:opacity-50"
                        title="Avaliar precisão fonética, ritmo e fonemas IPA"
                      >
                        <Activity
                          className={`w-3 h-3 ${
                            evaluatingPronunciationMsgId === msg.id ? 'animate-spin' : ''
                          }`}
                        />
                        <span>
                          {evaluatingPronunciationMsgId === msg.id
                            ? 'Calculando Score...'
                            : 'Avaliar Pronúncia Fonética'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* Visualizador de Taxa de Fala Rápido no Balão do Usuário (se não tiver card completo de pronúncia) */}
                {isUser && msg.speech_rate && !msg.pronunciation_score && (
                  <div className="mt-2 pt-1 border-t border-background/20">
                    <SpeechRateVisualizer
                      metrics={msg.speech_rate}
                      variant="compact"
                      allowLevelChange={true}
                    />
                  </div>
                )}

                {/* Componente de Score de Pronúncia & Gráfico de Precisão */}
                {isUser && msg.pronunciation_score && (
                  <div className="mt-3">
                    <PronunciationScoreCard
                      scoreData={msg.pronunciation_score}
                      targetLang={msg.idioma || 'en-US'}
                    />
                  </div>
                )}

                {/* Onda Sonora em Tempo Real (Waveform) dentro da Mensagem Ativa */}
                {!isUser && playingAudioId === msg.id && (
                  <TutorVoiceWaveform
                    variant="inline"
                    isPlaying={true}
                    activeId={msg.id}
                    voiceName={selectedVoice}
                    speed={speechSpeed}
                    onStop={handleStopAudio}
                  />
                )}

                {/* Botões de Ação Rápida de Reformulação Pedagógica (Tutor) */}
                {!isUser && (
                  <div className="mt-3 pt-2 border-t border-border/80 flex flex-wrap gap-1.5">
                    <button
                      onClick={() =>
                        handleSendMessage(
                          `Poderia explicar novamente esse ponto sobre ${currentTopic} usando uma analogia intuitiva do cotidiano?`
                        )
                      }
                      className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Pedir simplificação com metáfora"
                    >
                      🌱 Simplificar com Analogia
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage(
                          `Poderia aprofundar esse conceito com maior rigor técnico, propriedades formais e casos de borda?`
                        )
                      }
                      className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Pedir explicação técnica avançada"
                    >
                      🔬 Aprofundar Rigor Técnico
                    </button>
                    <button
                      onClick={() =>
                        handleSendMessage(
                          `Poderia me mostrar um exemplo prático passo a passo de aplicação desse conceito em ${currentTopic}?`
                        )
                      }
                      className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer"
                      title="Pedir exemplo aplicado"
                    >
                      💡 Ver Exemplo Prático
                    </button>
                  </div>
                )}

                {/* Card Especial de Correção Pedagógica */}
                {msg.correcao && (
                  <div className="mt-3 p-3.5 rounded-lg bg-background border border-border text-foreground text-xs space-y-2 relative">
                    <div className="flex items-center justify-between border-b border-border pb-1.5">
                      <div className="flex items-center space-x-1.5 text-foreground font-bold">
                        <AlertTriangle className="w-3.5 h-3.5 text-foreground" />
                        <span>Correção Pedagógica: {msg.correcao.conceito}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${
                          msg.correcao.gravidade === 'critica'
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : msg.correcao.gravidade === 'moderada'
                            ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            : 'border-border bg-muted text-muted-foreground'
                        }`}
                      >
                        Gravidade {msg.correcao.gravidade}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">OBSERVADO:</span>{' '}
                        <span className="text-foreground">{msg.correcao.erro}</span>
                      </div>
                      <div>
                        <span className="font-mono text-[11px] font-semibold text-muted-foreground">MOTIVO:</span>{' '}
                        <span className="text-muted-foreground">{msg.correcao.explicacao}</span>
                      </div>
                      <div className="p-2 rounded bg-muted/50 border border-border font-medium text-foreground flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          ✨ <strong>Formulação Correta:</strong> {msg.correcao.resposta_corrigida}
                        </div>
                        <button
                          onClick={() =>
                            handlePlayPhraseAudio(
                              `corr-${msg.correcao!.id || msg.id}`,
                              msg.correcao!.resposta_corrigida,
                              'en-US'
                            )
                          }
                          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono transition cursor-pointer border ${
                            playingAudioId === `corr-${msg.correcao!.id || msg.id}`
                              ? 'bg-foreground text-background border-foreground shadow-xs animate-pulse'
                              : 'bg-background hover:bg-muted text-foreground border-border'
                          }`}
                          title="Ouvir pronúncia nativa da frase corrigida"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>
                            {playingAudioId === `corr-${msg.correcao!.id || msg.id}`
                              ? 'Tocando...'
                              : 'Ouvir Frase'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Waveform dentro do card de correção */}
                    {playingAudioId === `corr-${msg.correcao!.id || msg.id}` && (
                      <TutorVoiceWaveform
                        variant="inline"
                        isPlaying={true}
                        activeId={`corr-${msg.correcao!.id || msg.id}`}
                        voiceName={selectedVoice}
                        speed={speechSpeed}
                        onStop={handleStopAudio}
                      />
                    )}

                    {/* Pergunta de Checagem Imediata */}
                    {msg.correcao.pergunta_confirmacao && (
                      <div className="pt-2 border-t border-border">
                        <div className="flex items-center space-x-1.5 font-mono font-bold text-foreground mb-1 text-[11px]">
                          <HelpCircle className="w-3.5 h-3.5 text-foreground" />
                          <span>CHECAGEM IMEDIATA (+40 XP):</span>
                        </div>
                        <p className="italic text-muted-foreground mb-2">
                          "{msg.correcao.pergunta_confirmacao}"
                        </p>

                        {answeringCorrectionId === msg.correcao.id ? (
                          <div className="flex gap-2 mt-1">
                            <input
                              type="text"
                              value={confirmationAnswer}
                              onChange={(e) => setConfirmationAnswer(e.target.value)}
                              placeholder="Digite sua resposta para validar a compreensão..."
                              className="flex-1 px-3 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-ring text-foreground"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleConfirmLearning(msg.correcao!);
                                }
                              }}
                            />
                            <Button
                              size="sm"
                              onClick={() => handleConfirmLearning(msg.correcao!)}
                              className="font-mono text-xs cursor-pointer"
                            >
                              Validar
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setAnsweringCorrectionId(msg.correcao!.id)}
                            className="gap-1.5 font-mono text-xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Responder Checagem Agora</span>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 justify-start items-center">
            <div className="w-7 h-7 rounded-md bg-foreground text-background flex items-center justify-center flex-shrink-0 text-[10px] font-mono font-bold">
              AI
            </div>
            <div className="bg-muted/50 text-foreground border border-border rounded-lg p-3 shadow-2xs flex items-center space-x-2 text-xs font-mono">
              <div className="w-2 h-2 rounded-full bg-foreground animate-ping" />
              <span>Consultando Grafo de Memória e adaptando explicação...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Caixa de Revisão de Transcrição de Áudio com Análise em Tempo Real de Taxa de Fala */}
      {reviewVoiceText && (
        <div className="my-2 p-3 bg-muted/60 border border-border rounded-lg space-y-2.5 text-xs text-foreground font-mono">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center space-x-2 overflow-hidden">
              <Volume2 className="w-4 h-4 text-foreground shrink-0" />
              <div className="truncate">
                <span className="font-bold">Áudio Transcrito:</span> "{reviewVoiceText}"
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <Button
                size="sm"
                onClick={() =>
                  handleSendMessage(reviewVoiceText, {
                    isAudio: true,
                    audioBase64: reviewVoiceAudioBase64 || undefined,
                    mimeType: reviewVoiceMimeType,
                    durationSeconds: reviewVoiceDuration,
                  })
                }
                className="font-mono text-xs cursor-pointer gap-1 bg-foreground text-background hover:bg-foreground/90"
              >
                <Activity className="w-3 h-3" />
                <span>Enviar & Avaliar Pronúncia</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReviewVoiceText(null);
                  setReviewVoiceAudioBase64(null);
                  setReviewVoiceDuration(0);
                }}
                className="font-mono text-xs cursor-pointer text-muted-foreground hover:text-foreground"
              >
                Descartar
              </Button>
            </div>
          </div>

          {/* Análise de Taxa de Fala em Tempo Real no Preview */}
          <div className="pt-2 border-t border-border/70">
            <SpeechRateVisualizer
              metrics={SpeechRateService.calculateSpeechRate(
                reviewVoiceText,
                reviewVoiceDuration || 2,
                SpeechRateService.mapStudentLevelToCEFR(studentLevel)
              )}
              variant="compact"
              allowLevelChange={true}
            />
          </div>
        </div>
      )}

      {audioError && (
        <div className="my-2 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center space-x-2 text-xs text-rose-600 dark:text-rose-400 font-mono">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{audioError}</span>
        </div>
      )}

      {/* Banner de Modo Ouvir Apenas (Treinamento Auditivo & Onda Sonora) */}
      {isListenOnlyMode && (
        <div className="mb-2 p-2.5 bg-muted/60 border border-border rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
          <div className="flex items-center space-x-2">
            <Headphones className="w-4 h-4 text-foreground shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-foreground">Modo Ouvir Apenas Ativo:</span>
              <span className="text-muted-foreground ml-1">
                Microfone pausado. Foco no treinamento auditivo, ritmo e ondas sonoras.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  `Por favor, fale um exemplo em inglês com connected speech sobre ${currentTopic} e explique os fonemas ligados.`
                )
              }
              className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] text-foreground transition cursor-pointer"
            >
              🎧 Treinar Linking Sounds
            </button>
            <button
              type="button"
              onClick={() =>
                handleSendMessage(
                  `Faça um desafio de ditado auditivo em inglês sobre ${currentTopic}: diga uma frase para eu tentar compreender.`
                )
              }
              className="px-2 py-0.5 rounded bg-background hover:bg-muted border border-border text-[10px] text-foreground transition cursor-pointer"
            >
              📝 Desafio de Ditado
            </button>
            <button
              type="button"
              onClick={() => setIsListenOnlyMode(false)}
              className="px-2 py-0.5 rounded bg-muted hover:bg-background border border-border text-[10px] text-muted-foreground hover:text-foreground transition cursor-pointer font-bold"
            >
              Desativar
            </button>
          </div>
        </div>
      )}

      {/* Barra de Entrada (Input, Microfone e Ações) */}
      <div
        className={`relative mt-3 bg-card border rounded-2xl p-2.5 sm:p-3 shadow-xs transition-all ${
          isRecording
            ? 'border-rose-500/60 ring-2 ring-rose-500/20'
            : isInputFocused
            ? 'border-primary ring-2 ring-primary/20'
            : 'border-border/80'
        }`}
      >
        {isRecording ? (
          <div className="space-y-3 p-3 bg-secondary/60 text-foreground rounded-xl border border-border/60">
            {/* Header com Botão de Entrada de Voz Ativo */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-600 dark:text-rose-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                </span>
                <Mic className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
                <span className="font-mono tracking-tight">GRAVANDO ({formatSeconds(recordingTime)})</span>
              </div>

              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  onClick={handleStopRecording}
                  className="gap-1.5 text-xs font-semibold cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs rounded-xl"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir & Enviar</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelRecording}
                  className="text-xs cursor-pointer text-muted-foreground hover:text-foreground rounded-xl"
                >
                  Cancelar
                </Button>
              </div>
            </div>

            {/* Visualizador de Espectro Reativo em Tempo Real */}
            <AudioSpectrumVisualizer
              stream={recordingStream}
              isActive={isRecording}
              height={60}
              showControls={true}
              showMetrics={true}
            />
          </div>
        ) : transcribing ? (
          <div className="flex items-center justify-center p-3 text-xs text-muted-foreground space-x-2">
            <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span>Processando áudio multimodal e gerando transcrição com Gemini...</span>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              id="tutor-chat-input"
              value={inputText}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                isListenOnlyMode
                  ? `Modo Ouvir Apenas: digite uma dúvida para o tutor falar e gerar onda sonora...`
                  : `Escreva sua dúvida ou explicação sobre ${currentTopic}...`
              }
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-foreground placeholder:text-muted-foreground"
              disabled={isLoading}
            />

            {/* Conversa por Voz em Tempo Real (Gemini Live API) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLiveModalOpen(true)}
              className="text-xs font-semibold gap-1.5 cursor-pointer hidden sm:flex border-border/80 hover:bg-secondary rounded-xl"
              title="Iniciar conversa por voz bidirecional em tempo real (Gemini Live API)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-foreground" />
              <span>Voz Live</span>
            </Button>

            {/* Gravação de Voz Rápida (Single-shot) com Espectro */}
            <div className="relative overflow-hidden rounded-xl">
              {isListenOnlyMode ? (
                <button
                  type="button"
                  onClick={() => setIsListenOnlyMode(false)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl border border-transparent transition cursor-pointer flex items-center justify-center opacity-60 hover:opacity-100"
                  title="Microfone pausado no modo Ouvir Apenas. Clique para reativar."
                >
                  <MicOff className="w-4 h-4 text-muted-foreground" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl border border-transparent hover:border-border/60 transition cursor-pointer flex items-center justify-center"
                  title="Gravar áudio com visualizador de espectro em tempo real"
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Botão de Envio */}
            <Button
              type="submit"
              size="sm"
              disabled={!inputText.trim() || isLoading}
              className="gap-1.5 text-xs font-semibold cursor-pointer shadow-xs rounded-xl px-3.5"
            >
              <span>Enviar</span>
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        )}
      </div>

      {/* Modal de Prática de Pronúncia com Espectro Vocal */}
      <PronunciationPracticeModal
        isOpen={isPronunciationModalOpen}
        onClose={() => setIsPronunciationModalOpen(false)}
        currentTopic={currentTopic}
        onUpdateStats={onUpdateStats}
      />
    </div>
  );
};
