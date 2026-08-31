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
  MessageSquarePlus,
  MessagesSquare,
  BookOpen,
  Plus,
  Check,
  FolderOpen,
  Maximize2,
  Minimize2,
  Eye,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  ChatMessage,
  ChatConversation,
  StudyMaterialItem,
  PedagogicalCorrection,
  UserStats,
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
import { QuickRepliesService, ReplyTipOption } from '../services/quickRepliesService';
import { TopicProficiencyBar } from './TopicProficiencyBar';
import { QuickRepliesContainer } from './QuickRepliesContainer';
import { LiveVoiceModal } from './LiveVoiceModal';
import { PronunciationPracticeModal } from './PronunciationPracticeModal';
import { PronunciationScoreCard } from './PronunciationScoreCard';
import { SpeechRateVisualizer } from './SpeechRateVisualizer';
import { SpeechRateCoachModal } from './SpeechRateCoachModal';
import { AudioSpectrumVisualizer } from './AudioSpectrumVisualizer';
import { PronunciationWaveformVisualizer } from './PronunciationWaveformVisualizer';
import { TutorVoiceWaveform } from './TutorVoiceWaveform';
import { WordContextModal } from './WordContextModal';
import { InteractiveWordText } from './InteractiveWordText';
import { playSfx } from '../services/soundEffects';
import { saveFrequentErrorToCloud, auth } from '../services/firebase';
import { CornerPlus } from './ui/corner-plus';
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
  const [practiceWordForModal, setPracticeWordForModal] = useState<string | undefined>(undefined);

  // Modal de Contexto de Palavras & Dicionário Ativo (Word Click)
  const [selectedWordForContext, setSelectedWordForContext] = useState<string | null>(null);
  const [contextSentenceForWord, setContextSentenceForWord] = useState<string>('');
  const [isWordContextOpen, setIsWordContextOpen] = useState(false);

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

  // Multi-conversas e Sessões por Lição
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string>('');
  const [isConvMenuOpen, setIsConvMenuOpen] = useState(false);
  const [isNewConvModalOpen, setIsNewConvModalOpen] = useState(false);
  const [newConvTab, setNewConvTab] = useState<'lessons' | 'prompts' | 'custom'>('lessons');
  const [customConvTitle, setCustomConvTitle] = useState('');
  const [customConvTopic, setCustomConvTopic] = useState('');

  // Modo Foco (Imersão Total sem Distrações)
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);

  // Dicas Pedagógicas de Como Responder (Modelos de Frase para Aprendizado Ativo)
  const [replyTips, setReplyTips] = useState<ReplyTipOption[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);
  const timerIntervalRef = useRef<any>(null);

  // Escuta tecla ESC para sair do Modo Foco
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusMode) {
        setIsFocusMode(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode]);

  // Atualiza as dicas de modelo de resposta quando chegam novas mensagens ou muda o tópico/idioma
  useEffect(() => {
    const lastTutorMsg = [...messages].reverse().find((m) => m.remetente === 'tutor')?.conteudo;
    const tips = QuickRepliesService.generateTips(
      lastTutorMsg,
      currentTopic,
      stats.idioma_ativo || 'Inglês'
    );
    setReplyTips(tips);
  }, [messages, currentTopic, stats.idioma_ativo]);

  // Sincroniza lista de conversas e conversa ativa
  const refreshConversations = () => {
    const allConvs = StorageService.getConversations();
    setConversations(allConvs);
    const active = StorageService.getActiveConversation();
    if (active) {
      setActiveConvId(active.id);
      setMessages(active.mensagens || []);
    } else {
      const history = StorageService.getChatHistory();
      setMessages(history);
    }
  };

  useEffect(() => {
    refreshConversations();
    audioRecorderRef.current = new AudioRecorderService();

    // Inscreve no serviço de síntese de voz
    const unsubscribeSpeech = SpeechService.subscribe((isPlaying, id) => {
      setPlayingAudioId(isPlaying ? id : null);
    });

    return () => {
      unsubscribeSpeech();
      SpeechService.stop();
    };
  }, [currentTopic, stats.idioma_ativo]);

  const handleSelectConversation = (convId: string) => {
    StorageService.setActiveConversationId(convId);
    setActiveConvId(convId);
    const conv = StorageService.getConversation(convId);
    if (conv) {
      setMessages(conv.mensagens || []);
      if (conv.topico && conv.topico !== currentTopic) {
        onSelectTopic(conv.topico);
      }
    }
    setIsConvMenuOpen(false);
    playSfx('pop');
  };

  const handleCreateNewConversationForLesson = (material: StudyMaterialItem) => {
    const newConv = StorageService.createConversation({
      materialId: material.id,
      materialTitulo: material.titulo,
      topico: material.titulo,
      idioma: material.idioma_alvo,
      nivelCefr: material.nivel_cefr as any,
    });
    setConversations(StorageService.getConversations());
    setActiveConvId(newConv.id);
    setMessages(newConv.mensagens);
    onSelectTopic(newConv.topico);
    setIsNewConvModalOpen(false);
    setIsConvMenuOpen(false);
    playSfx('success');
  };

  const handleCreateNewCustomConversation = (topic: string, title?: string) => {
    if (!topic.trim()) return;
    const newConv = StorageService.createConversation({
      titulo: title?.trim() || undefined,
      topico: topic.trim(),
      idioma: stats.idioma_ativo,
      nivelCefr: stats.nivel_cefr,
    });
    setConversations(StorageService.getConversations());
    setActiveConvId(newConv.id);
    setMessages(newConv.mensagens);
    onSelectTopic(newConv.topico);
    setIsNewConvModalOpen(false);
    setIsConvMenuOpen(false);
    setCustomConvTitle('');
    setCustomConvTopic('');
    playSfx('success');
  };

  const handleDeleteConversation = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (window.confirm('Tem certeza de que deseja excluir esta conversa?')) {
      StorageService.deleteConversation(id);
      const remaining = StorageService.getConversations();
      setConversations(remaining);
      const newActiveId = StorageService.getActiveConversationId();
      setActiveConvId(newActiveId);
      setMessages(StorageService.getChatHistory(newActiveId));
      playSfx('pop');
    }
  };

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

    playSfx('pop');
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
      const activePlan = StorageService.getStudyPlan();
      const currentLanguage = stats.idioma_ativo || activePlan?.idioma || 'Inglês';
      const graphContext = GraphEngine.getRelevantContext(
        currentTopic,
        content,
        5,
        currentLanguage
      );
      const recentCorrections = StorageService.getCorrections().slice(0, 3);

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
          idioma_alvo: currentLanguage,
          nivel_estudante: stats.nivel_cefr || studentLevel,
          plano_estudo: activePlan,
          motivo_estudo: activePlan?.motivo_principal,
          interesses: activePlan?.interesses_principais,
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
        GraphEngine.processNewNodesFromTutor(data.novos_nos_grafo, content, currentLanguage);
      }

      // 4. Registra adaptação nos nós do grafo para rastreabilidade
      const effectiveAdaptation = GraphEngine.analyzeStudentComprehension(
        currentTopic,
        content,
        currentLanguage
      );
      if (effectiveAdaptation) {
        GraphEngine.recordAdaptationUsed(currentTopic, effectiveAdaptation, currentLanguage);
      }

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

        // Salva automaticamente na lista de Erros Frequentes do Firestore
        try {
          const currentAuthUser = auth.currentUser;
          if (currentAuthUser) {
            await saveFrequentErrorToCloud({
              id: pedagogicalCorrection.id,
              userId: currentAuthUser.uid,
              userEmail: currentAuthUser.email || undefined,
              userName: currentAuthUser.displayName || undefined,
              conceito: pedagogicalCorrection.conceito,
              erro: pedagogicalCorrection.erro,
              explicacao: pedagogicalCorrection.explicacao,
              resposta_corrigida: pedagogicalCorrection.resposta_corrigida,
              gravidade: pedagogicalCorrection.gravidade,
              evidencia: pedagogicalCorrection.evidencia,
              topico: currentTopic,
              categoria: 'gramatica',
              data: pedagogicalCorrection.data,
            });
          }
        } catch (cloudErr) {
          console.warn('Erro ao salvar erro frequente no Firestore:', cloudErr);
        }
      }

      // 6. Atribui XP e atualiza gamificação
      const xpAmount = data.xp_ganho || (data.possui_erro ? 15 : 25);
      const xpResult = StorageService.addXP(xpAmount);
      StorageService.recordAnswer(!data.possui_erro);
      onUpdateStats(xpResult.stats);

      // Avalia conquistas desbloqueadas
      const evalRes = AchievementEngine.evaluateAll();
      if (evalRes.newlyUnlocked.length > 0) {
        onUpdateStats(StorageService.getStats());
      }

      if (xpResult.subiu_nivel) {
        playSfx('level_up');
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        playSfx('notification');
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
        adaptacao: effectiveAdaptation ?? undefined,
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
        playSfx('success');
        StorageService.addXP(40);
        onUpdateStats(StorageService.getStats());
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.7 },
        });
      } else {
        playSfx('error');
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
      StorageService.clearChatHistory(activeConvId);
      setMessages([]);
      setConversations(StorageService.getConversations());
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

  const activePlan = StorageService.getStudyPlan();
  const currentLang = stats.idioma_ativo || activePlan?.idioma || 'Inglês';

  const getLanguageQuickPrompts = () => {
    const topicClean = currentTopic.replace(/^(Francês|Inglês|Espanhol|Alemão|Italiano|Japonês):\s*/i, '');
    if (activePlan) {
      if (currentLang === 'Francês') {
        return [
          `Bonjour ! Comment puis-je me présenter naturellement en français ?`,
          `Simule um diálogo prático sobre ${topicClean} em francês`,
          `Quelles sont les expressions clés pour ${topicClean} ?`,
          `Pode me fazer uma pergunta em francês sobre meu foco (${activePlan.motivo_principal})?`,
        ];
      }
      if (currentLang === 'Espanhol') {
        return [
          `¡Hola! ¿Cómo puedo iniciar una conversación natural sobre ${topicClean}?`,
          `Simule um diálogo casual de roleplay sobre ${topicClean} em espanhol`,
          `¿Cuáles son los falsos amigos más comunes en ${topicClean}?`,
          `Hazme una pregunta en español para poner a prueba mi fluidez`,
        ];
      }
      if (currentLang === 'Inglês') {
        return [
          `Hello! Let's start our conversation about ${topicClean}`,
          `Simule um diálogo casual de roleplay sobre ${topicClean}`,
          `What are the most natural expressions and idioms for ${topicClean}?`,
          `Ask me a challenging question in English about ${topicClean}`,
        ];
      }
      return [
        `Olá! Vamos começar nossa prática de ${currentLang} focada em ${topicClean}`,
        `Simule um diálogo prático sobre ${topicClean} em ${currentLang}`,
        `Quais expressões essenciais devo saber para ${topicClean}?`,
        `Faça uma pergunta para testar minha conversação em ${currentLang}`,
      ];
    }
    return [
      `Simule um diálogo casual de roleplay sobre ${currentTopic}`,
      `Quais falsos cognatos e erros de tradução ocorrem em ${currentTopic}?`,
      `Me dê 3 expressões naturais e práticas sobre ${currentTopic}`,
      `Faça uma pergunta desafiadora em ${currentLang} para testar minha resposta`,
    ];
  };

  const quickPrompts = getLanguageQuickPrompts();

  const handleResetToPlan = () => {
    const updated = StorageService.resetChatToStudyPlan(activePlan || undefined);
    setMessages(updated);
    playSfx('success');
  };

  // Coleta todas as métricas de taxa de fala das mensagens faladas do usuário na sessão
  const allSpokenMetrics: SpeechRateMetrics[] = messages
    .filter(
      (m) =>
        m.remetente === 'user' && (m.speech_rate || m.pronunciation_score?.speech_rate)
    )
    .map((m) => (m.speech_rate || m.pronunciation_score?.speech_rate)!)
    .filter(Boolean);

  return (
    <div
      className={`flex flex-col transition-all duration-300 ${
        isFocusMode
          ? 'fixed inset-0 z-50 bg-[var(--bg)] p-3 sm:p-6 overflow-hidden h-screen max-w-none shadow-2xl backdrop-blur-md'
          : 'h-[calc(100vh-4.5rem)] max-w-5xl w-full mx-auto p-2 sm:p-4'
      }`}
    >
      {/* Banner de Modo Foco Ativo (se ativado) */}
      {isFocusMode && (
        <div className="shrink-0 mb-2 px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="font-bold text-[var(--fg)]">Modo Foco Ativo:</span>
            <span className="text-[var(--muted)] truncate hidden sm:inline">
              Área maximizada para imersão total no diálogo com o tutor (Pressione ESC para sair)
            </span>
          </div>

          <Button
            size="sm"
            variant="default"
            onClick={() => setIsFocusMode(false)}
            className="gap-1.5 text-xs font-bold cursor-pointer rounded-full bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg)]/90 shrink-0 shadow-xs"
            title="Sair do Modo Foco e restaurar layout padrão"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Sair do Foco</span>
          </Button>
        </div>
      )}

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

      {/* Banner de Plano de Estudos Ativo (se houver) */}
      {activePlan && (
        <div className="mb-2.5 p-2.5 sm:px-4 bg-primary/5 border border-primary/20 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-sm">🎯</span>
            <div className="truncate">
              <span className="font-bold text-foreground">Plano Ativo:</span>{' '}
              <span className="font-semibold text-primary">{activePlan.titulo_plano || `${activePlan.idioma} Personalizado`}</span>
              <span className="hidden md:inline text-muted-foreground ml-2">
                • Nível {activePlan.nivel_cefr} • Foco: {activePlan.motivo_principal} ({activePlan.meta_diaria_minutos} min/dia)
              </span>
            </div>
          </div>
          <button
            onClick={handleResetToPlan}
            className="shrink-0 text-[11px] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer bg-primary/10 hover:bg-primary/20 px-2.5 py-1 rounded-full transition"
            title="Reiniciar a conversa para o tópico inicial do seu plano de estudos"
          >
            <span>Reiniciar com o Plano</span>
          </button>
        </div>
      )}

      {/* Barra Superior Compacta e Unificada do Chat */}
      <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-2.5 sm:p-3.5 mb-2 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Lado Esquerdo: Identificação do Tópico e Seletor de Conversa */}
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              CT
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground truncate">
                  {currentTopic}
                </h2>
                <span className="hidden sm:inline-flex items-center rounded-full border border-border/80 bg-secondary px-2 py-0.2 font-mono text-[9px] font-semibold text-muted-foreground uppercase shrink-0">
                  {stats.idioma_ativo || 'Ativo'}
                </span>
              </div>

              {/* Seletor Inline de Conversas */}
              <div className="relative mt-0.5 flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setIsConvMenuOpen(!isConvMenuOpen)}
                  className="inline-flex items-center space-x-1.5 bg-stone-100 dark:bg-stone-800/70 hover:bg-stone-200 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-700 px-2 py-0.5 rounded-md text-[11px] font-medium text-stone-700 dark:text-stone-300 transition cursor-pointer max-w-[220px] sm:max-w-[320px]"
                  title="Alternar entre conversas salvas"
                >
                  <MessagesSquare className="w-3 h-3 text-stone-500 shrink-0" />
                  <span className="truncate">
                    {conversations.find((c) => c.id === activeConvId)?.titulo || 'Conversa Ativa'}
                  </span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/15 text-amber-800 dark:text-amber-300 font-mono font-bold shrink-0">
                    {messages.length} msg
                  </span>
                  <ChevronDown className="w-3 h-3 text-stone-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsNewConvModalOpen(true)}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:underline px-1.5 py-0.5 cursor-pointer"
                  title="Criar nova conversa"
                >
                  <Plus className="w-3 h-3" />
                  <span className="hidden sm:inline">Nova</span>
                </button>

                {/* Menu Dropdown de Conversas */}
                {isConvMenuOpen && (
                  <div className="absolute left-0 top-full mt-1.5 w-80 sm:w-96 bg-white dark:bg-zinc-900 border-2 border-stone-300 dark:border-zinc-700 rounded-xl shadow-2xl p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between px-2 py-1 border-b border-stone-200 dark:border-zinc-800 mb-1.5">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100">Minhas Conversas</span>
                      <span className="text-[10px] font-mono text-stone-500">
                        {conversations.length} {conversations.length === 1 ? 'conversa' : 'conversas'}
                      </span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 py-1">
                      {conversations.map((c) => {
                        const isSelected = c.id === activeConvId;
                        return (
                          <div
                            key={c.id}
                            onClick={() => handleSelectConversation(c.id)}
                            className={`p-2 rounded-lg flex items-start justify-between gap-2 cursor-pointer transition text-xs ${
                              isSelected
                                ? 'bg-amber-500/10 border-2 border-amber-500 text-stone-900 dark:text-stone-100 font-bold'
                                : 'bg-stone-50 dark:bg-zinc-800/80 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-start space-x-2 min-w-0">
                              {c.material_id ? (
                                <BookOpen className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                              ) : (
                                <MessagesSquare className="w-3.5 h-3.5 text-stone-500 mt-0.5 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="truncate text-stone-900 dark:text-stone-100 font-semibold">{c.titulo}</p>
                                <p className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                                  {c.topico} • {c.mensagens?.length || 0} msgs
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center space-x-1 shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
                              {conversations.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeleteConversation(c.id, e)}
                                  className="p-1 text-stone-400 hover:text-rose-500 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                                  title="Excluir conversa"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-stone-200 dark:border-zinc-800 mt-1">
                      <Button
                        size="sm"
                        onClick={() => {
                          setIsConvMenuOpen(false);
                          setIsNewConvModalOpen(true);
                        }}
                        className="w-full gap-1.5 text-xs font-semibold cursor-pointer py-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Iniciar Nova Conversa</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lado Direito: Ações Principais e Modos */}
          <div className="flex items-center flex-wrap gap-1.5">
            {/* Voz Live Gemini API */}
            <Button
              size="sm"
              variant="default"
              onClick={() => setIsLiveModalOpen(true)}
              className="gap-1.5 text-xs font-bold cursor-pointer rounded-full bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg)]/90 h-8 px-3"
              title="Conversar por voz em tempo real com Gemini Live"
            >
              <Radio className="w-3 h-3 animate-pulse text-[var(--accent)]" />
              <span>Voz Live (API)</span>
            </Button>

            {/* Modo Foco */}
            <Button
              variant={isFocusMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setIsFocusMode((prev) => !prev)}
              className={`gap-1 text-xs font-bold cursor-pointer rounded-full h-8 px-2.5 transition-all ${
                isFocusMode
                  ? 'bg-amber-500 text-stone-900 border-amber-600 shadow-sm'
                  : 'border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)]'
              }`}
              title={isFocusMode ? 'Sair do Modo Foco' : 'Modo Foco: imersão total'}
            >
              {isFocusMode ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              <span className="hidden sm:inline">{isFocusMode ? 'Sair do Foco' : 'Modo Foco'}</span>
            </Button>

            {/* Treino de Pronúncia */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPronunciationModalOpen(true)}
              className="gap-1 text-xs font-bold cursor-pointer rounded-full h-8 px-2.5 hidden sm:inline-flex"
              title="Praticar pronúncia"
            >
              <Mic className="w-3 h-3 text-[var(--fg)]" />
              <span>Pronúncia</span>
            </Button>

            {/* Treinador WPM */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSpeechRateCoachOpen(true)}
              className="gap-1 text-xs font-bold cursor-pointer rounded-full h-8 px-2.5 hidden md:inline-flex"
              title="Taxa de fala em palavras por minuto"
            >
              <Gauge className="w-3 h-3 text-[var(--fg)]" />
              <span>WPM</span>
            </Button>

            {/* Modo Ouvir */}
            <Button
              variant={isListenOnlyMode ? 'default' : 'outline'}
              size="sm"
              onClick={handleToggleListenOnly}
              className="gap-1 text-xs font-bold cursor-pointer rounded-full h-8 px-2.5 hidden md:inline-flex"
              title="Modo treino auditivo"
            >
              <Headphones className={`w-3 h-3 ${isListenOnlyMode ? 'animate-bounce text-[var(--accent)]' : 'text-[var(--fg)]'}`} />
              <span>{isListenOnlyMode ? 'Ouvindo' : 'Ouvir'}</span>
            </Button>

            {/* Seletor de Adaptação */}
            <div className="flex items-center space-x-1 bg-[oklch(0.96_0.01_84)] border border-[var(--border)] px-2 py-1 rounded-full text-[11px] h-8">
              <Sliders className="w-3 h-3 text-[var(--fg)] shrink-0" />
              <select
                value={adaptationPreference}
                onChange={(e) => setAdaptationPreference(e.target.value as any)}
                className="bg-transparent font-bold text-[var(--fg)] focus:outline-none cursor-pointer text-[11px]"
                title="Calibração pedagógica"
              >
                <option value="auto">🧠 Auto</option>
                <option value="fundamental_analogico">🌱 Fundamental</option>
                <option value="intermediario_aplicado">⚡ Intermediário</option>
                <option value="avancado_analitico">🔬 Avançado</option>
              </select>
            </div>

            {/* Seletor de Voz IA */}
            <div className="flex items-center space-x-1 bg-[oklch(0.96_0.01_84)] border border-[var(--border)] px-2 py-1 rounded-full text-[11px] h-8 hidden sm:inline-flex">
              <Volume2 className="w-3 h-3 text-[var(--fg)] shrink-0" />
              <select
                value={selectedVoice}
                onChange={(e) => handleVoiceChange(e.target.value)}
                className="bg-transparent font-bold text-[var(--fg)] focus:outline-none cursor-pointer text-[11px]"
                title="Voz neural da IA"
              >
                {NEURAL_VOICES.map((v) => (
                  <option key={v.id} value={v.id} className="bg-[var(--surface)] text-[var(--fg)]">
                    ✨ {v.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Limpar Histórico */}
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-1.5 text-[var(--muted)] hover:text-rose-500 rounded-full border border-transparent hover:border-[var(--border)] transition cursor-pointer"
              title="Limpar histórico"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Barra Compacta de Proficiência Integrada */}
        <div className="mt-2 pt-2 border-t border-[var(--border)]">
          <TopicProficiencyBar
            currentTopic={currentTopic}
            stats={stats}
            messagesCount={messages.length}
            isFocusMode={isFocusMode}
          />
        </div>
      </div>

      {/* Modal de Criação de Nova Conversa (Livre ou por Lição) */}
      {isNewConvModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border-2 border-stone-300 dark:border-zinc-700 rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150 text-stone-900 dark:text-stone-100">
            <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <MessageSquarePlus className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-display">Iniciar Nova Conversa</h3>
              </div>
              <button
                onClick={() => setIsNewConvModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 text-base font-bold p-1 rounded-md hover:bg-stone-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tabs de Seleção */}
            <div className="flex border-b border-stone-200 dark:border-zinc-800 gap-2">
              <button
                onClick={() => setNewConvTab('lessons')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  newConvTab === 'lessons'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Por Lição ({StorageService.getMaterials().length})</span>
              </button>
              <button
                onClick={() => setNewConvTab('prompts')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  newConvTab === 'prompts'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Tópicos Sugeridos</span>
              </button>
              <button
                onClick={() => setNewConvTab('custom')}
                className={`pb-2 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  newConvTab === 'custom'
                    ? 'border-amber-600 text-amber-600 dark:text-amber-400 dark:border-amber-400'
                    : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Personalizado</span>
              </button>
            </div>

            {/* Conteúdo das Tabs */}
            <div className="flex-1 overflow-y-auto space-y-3 py-1">
              {newConvTab === 'lessons' && (
                <div className="space-y-2">
                  <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
                    Selecione uma lição para praticar com o tutor pedagógico. A conversa será
                    contextualizada com os vocabulários e estruturas da lição:
                  </p>
                  {StorageService.getMaterials().length === 0 ? (
                    <div className="p-5 bg-stone-50 dark:bg-zinc-800/80 rounded-xl border border-stone-200 dark:border-zinc-700 text-center space-y-2 text-xs text-stone-500 dark:text-stone-400">
                      <BookOpen className="w-7 h-7 mx-auto text-stone-400" />
                      <p className="font-semibold text-stone-700 dark:text-stone-300">Nenhuma lição cadastrada ainda no Estúdio de Materiais.</p>
                      <p className="text-[11px]">
                        Você também pode escolher um dos Tópicos Sugeridos ou criar uma conversa personalizada!
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {StorageService.getMaterials().map((mat) => (
                        <div
                          key={mat.id}
                          onClick={() => handleCreateNewConversationForLesson(mat)}
                          className="p-3 bg-stone-50 dark:bg-zinc-800/90 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:border-amber-500 rounded-xl cursor-pointer transition flex items-center justify-between gap-3 text-xs shadow-xs"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-stone-900 dark:text-stone-100 truncate">{mat.titulo}</span>
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-400 font-mono text-[10px] font-bold shrink-0">
                                {mat.idioma_alvo} • {mat.nivel_cefr}
                              </span>
                            </div>
                            <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1">
                              {mat.vocabulario?.length || 0} vocábulos • {mat.flashcards?.length || 0} flashcards
                            </p>
                          </div>
                          <Button size="sm" className="shrink-0 text-xs gap-1 cursor-pointer">
                            <span>Praticar</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {newConvTab === 'prompts' && (
                <div className="space-y-2">
                  <p className="text-xs text-stone-600 dark:text-stone-400">
                    Escolha um tema recomendado para iniciar um diálogo guiado:
                  </p>
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {quickPrompts.map((p, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleCreateNewCustomConversation(p, p.slice(0, 45) + '...')}
                        className="p-3 bg-stone-50 dark:bg-zinc-800/90 hover:bg-stone-100 dark:hover:bg-zinc-800 border border-stone-200 dark:border-zinc-700 hover:border-amber-500 rounded-xl cursor-pointer transition text-xs flex items-center justify-between gap-2 shadow-xs"
                      >
                        <span className="text-stone-900 dark:text-stone-100 font-medium">{p}</span>
                        <ChevronRight className="w-4 h-4 text-stone-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {newConvTab === 'custom' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customConvTopic.trim()) {
                      handleCreateNewCustomConversation(customConvTopic, customConvTitle);
                    }
                  }}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-stone-900 dark:text-stone-100 mb-1">
                      Título da Conversa (Opcional):
                    </label>
                    <input
                      type="text"
                      value={customConvTitle}
                      onChange={(e) => setCustomConvTitle(e.target.value)}
                      placeholder="Ex: Treino para Entrevista, Prática de Restaurante..."
                      className="w-full bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-900 dark:text-stone-100 mb-1">
                      Tópico ou Situação de Estudo:
                    </label>
                    <textarea
                      value={customConvTopic}
                      onChange={(e) => setCustomConvTopic(e.target.value)}
                      placeholder="Ex: Simular uma negociação comercial em francês ou pedir comida em um restaurante em Paris..."
                      rows={3}
                      required
                      className="w-full bg-stone-50 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 rounded-lg p-3 text-xs text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-stone-200 dark:border-zinc-800">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsNewConvModalOpen(false)}
                      className="text-xs cursor-pointer"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!customConvTopic.trim()}
                      className="text-xs gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Iniciar Conversa</span>
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Painel Central de Mensagens */}
      <div className="relative flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-4 sm:p-6 overflow-y-auto space-y-4 shadow-sm overflow-hidden flex flex-col">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--fg)] shadow-xs">
              <Sparkles className="w-6 h-6 text-[var(--fg)]" />
            </div>
            <div className="max-w-md space-y-1.5">
              <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)] px-3 py-0.5 font-mono text-[10px] font-extrabold text-[var(--fg)] uppercase tracking-wider">
                ACTIVE LEARNING SESSION
              </div>
              <h3 className="text-xl font-display font-bold tracking-tight text-[var(--fg)]">
                Pronto para iniciar sua sessão de aprendizado ativo!
              </h3>
              <p className="text-xs text-[var(--muted)] leading-relaxed">
                Converse com o tutor por texto ou voz. Suas dúvidas, equívocos e domínios serão
                mapeados dinamicamente no seu Grafo de Conhecimento.
              </p>
            </div>

            <div className="w-full max-w-lg pt-2 space-y-3">
              {/* Card de Ação Rápida: Gemini Live */}
              <div className="relative p-4 bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-[var(--r-md)] flex items-center justify-between shadow-xs gap-3">
                <div className="flex items-center space-x-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[var(--fg)]">
                      Prática Conversacional em Tempo Real
                    </h4>
                    <p className="text-xs text-[var(--muted)]">
                      Converse por voz com o tutor (Gemini Live API) com baixa latência e fala bidirecional.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => setIsLiveModalOpen(true)}
                  className="font-bold text-xs shrink-0 cursor-pointer rounded-full"
                >
                  Falar Agora
                </Button>
              </div>

              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--muted)] block mb-2 text-center">
                Ou escolha uma sugestão rápida de prompt:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
                {quickPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="p-3 rounded-xl bg-[var(--surface)] hover:bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-xs text-[var(--fg)] font-medium transition-all flex items-center justify-between group shadow-2xs cursor-pointer"
                  >
                    <span className="truncate mr-2 font-sans text-xs">{prompt}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-[var(--fg)] shrink-0" />
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
                className="max-w-md mx-auto my-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-600 text-xs text-center flex items-center justify-center space-x-2 font-mono"
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
                <div className="w-8 h-8 rounded-full bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5 shadow-xs border border-[var(--border)]">
                  AI
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[82%] rounded-[var(--r-md)] p-4 sm:p-4.5 shadow-xs transition-all ${
                  isUser
                    ? 'bg-[var(--accent)] text-[var(--fg)] font-medium rounded-tr-xs border border-[var(--border)]'
                    : 'bg-[oklch(0.97_0.01_84)] text-[var(--fg)] rounded-tl-xs border border-[var(--border)]'
                }`}
              >
                {/* Remetente & Badge XP */}
                <div className="flex items-center justify-between text-[11px] mb-2 space-x-2">
                  <span className="font-bold tracking-tight text-[var(--fg)]">
                    {isUser ? 'Você' : 'Tutor de Línguas'}
                  </span>
                  <div className="flex items-center space-x-1.5">
                    {!isUser && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleToggleMessageAudio(msg.id, msg.conteudo)}
                          className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer border ${
                            playingAudioId === msg.id
                              ? 'bg-[var(--fg)] text-[var(--accent)] border-[var(--fg)] shadow-xs animate-pulse'
                              : isVoiceLoading && playingAudioId === msg.id
                              ? 'bg-[var(--surface)] text-[var(--fg)] border-[var(--border)] animate-pulse'
                              : 'bg-[var(--surface)] text-[var(--fg)] hover:bg-[oklch(0.95_0.01_84)] border-[var(--border)]'
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
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]"></span>
                              </span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-[var(--fg)]" />
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
                <div className="text-xs sm:text-sm leading-relaxed">
                  {isUser ? (
                    <div className="whitespace-pre-line">{msg.conteudo}</div>
                  ) : (
                    <div>
                      <InteractiveWordText
                        text={msg.conteudo}
                        onWordClick={(clickedWord, sentence) => {
                          setSelectedWordForContext(clickedWord);
                          setContextSentenceForWord(sentence);
                          setIsWordContextOpen(true);
                        }}
                      />
                      <div className="mt-2 pt-1.5 border-t border-[var(--border)]/40 flex items-center gap-1.5 text-[10px] text-[var(--muted)] font-mono">
                        <Sparkles className="w-3 h-3 text-[var(--accent-deep)] shrink-0" />
                        <span>Dica: clique em qualquer palavra acima para ver sinônimos, IPA e contexto</span>
                      </div>
                    </div>
                  )}
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

      {/* Dicas Pedagógicas de Como Responder (Modelos de Frase para Ensinar o Usuário) */}
      {!isRecording && !transcribing && replyTips.length > 0 && (
        <div className="mb-2">
          <QuickRepliesContainer
            tips={replyTips}
            onApplyStarter={(starterText) => {
              setInputText((prev) => {
                const trimmed = prev.trim();
                return trimmed ? `${trimmed} ${starterText}` : starterText;
              });
              const inputElem = document.getElementById('tutor-chat-input');
              inputElem?.focus();
            }}
            disabled={isLoading}
          />
        </div>
      )}

      {/* Barra de Entrada (Input, Microfone e Ações) */}
      <div
        className={`relative mt-3 bg-[var(--surface)] border rounded-[var(--r-md)] p-2.5 sm:p-3 shadow-xs transition-all ${
          isRecording
            ? 'border-rose-500 ring-2 ring-rose-500/20'
            : isInputFocused
            ? 'border-[var(--fg)] ring-2 ring-[var(--fg)]/10'
            : 'border-[var(--border)]'
        }`}
      >
        {isRecording ? (
          <div className="space-y-3 p-3 bg-[oklch(0.97_0.01_84)] text-[var(--fg)] rounded-2xl border border-[var(--border)]">
            {/* Header com Botão de Entrada de Voz Ativo */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-xs font-bold text-rose-600">
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
                  className="gap-1.5 text-xs font-bold cursor-pointer bg-[var(--fg)] text-[var(--bg)] hover:bg-[var(--fg)]/90 shadow-xs rounded-full"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Concluir & Enviar</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCancelRecording}
                  className="text-xs cursor-pointer text-[var(--muted)] hover:text-[var(--fg)] rounded-full"
                >
                  Cancelar
                </Button>
              </div>
            </div>

            {/* Visualizador de Onda de Áudio (Waveform) e Espectro Reativo em Tempo Real */}
            <PronunciationWaveformVisualizer
              stream={recordingStream}
              isActive={isRecording}
              height={84}
              mode="waveform"
              showControls={true}
              showMetrics={true}
              title="Captação de Microfone & Onda Sonora em Tempo Real"
            />
          </div>
        ) : transcribing ? (
          <div className="flex items-center justify-center p-3 text-xs text-[var(--muted)] space-x-2">
            <div className="w-4 h-4 rounded-full border-2 border-[var(--fg)] border-t-transparent animate-spin" />
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
              className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-transparent border-0 focus:outline-none text-[var(--fg)] placeholder:text-[var(--muted)]"
              disabled={isLoading}
            />

            {/* Conversa por Voz em Tempo Real (Gemini Live API) */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsLiveModalOpen(true)}
              className="text-xs font-bold gap-1.5 cursor-pointer hidden sm:flex border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)] rounded-full"
              title="Iniciar conversa por voz bidirecional em tempo real (Gemini Live API)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-[var(--fg)]" />
              <span>Voz Live</span>
            </Button>

            {/* Gravação de Voz Rápida (Single-shot) com Espectro */}
            <div className="relative overflow-hidden rounded-full">
              {isListenOnlyMode ? (
                <button
                  type="button"
                  onClick={() => setIsListenOnlyMode(false)}
                  className="p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] rounded-full border border-transparent transition cursor-pointer flex items-center justify-center opacity-60 hover:opacity-100"
                  title="Microfone pausado no modo Ouvir Apenas. Clique para reativar."
                >
                  <MicOff className="w-4 h-4 text-[var(--muted)]" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="p-2 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] rounded-full border border-transparent hover:border-[var(--border)] transition cursor-pointer flex items-center justify-center"
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
              className="gap-1.5 text-xs font-bold cursor-pointer shadow-xs rounded-full px-4"
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
        onClose={() => {
          setIsPronunciationModalOpen(false);
          setPracticeWordForModal(undefined);
        }}
        currentTopic={currentTopic}
        onUpdateStats={onUpdateStats}
        initialPhrase={practiceWordForModal}
      />

      {/* Modal de Contexto de Palavras & Dicionário Ativo */}
      <WordContextModal
        isOpen={isWordContextOpen}
        onClose={() => setIsWordContextOpen(false)}
        word={selectedWordForContext}
        sentenceContext={contextSentenceForWord}
        language={stats.idioma_ativo || 'Inglês'}
        topic={currentTopic}
        onPracticePronunciation={(wordToPractice) => {
          setPracticeWordForModal(wordToPractice);
          setIsPronunciationModalOpen(true);
        }}
        onAskTutor={(question) => {
          setInputText(question);
          handleSendMessage(question);
        }}
      />
    </div>
  );
};
