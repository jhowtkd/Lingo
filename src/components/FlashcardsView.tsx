import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Layers,
  RotateCw,
  Volume2,
  Mic,
  MicOff,
  Sparkles,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Flame,
  Trophy,
  Brain,
  Headphones,
  Shuffle,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Filter,
  Check,
  Award,
  BookOpen,
  Info,
  Calendar,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  SRSFlashcard,
  SRSGrade,
  SRSReviewResult,
  FlashcardFilterMode,
  FlashcardSessionSummary,
  UserStats,
  LanguageThemeConfig,
} from '../types';
import { FlashcardsEngine } from '../services/flashcardsEngine';
import { SpeechService } from '../services/speechSynthesisService';
import { AudioRecorderService } from '../services/audioService';
import { getLanguageTheme } from '../services/languageThemes';
import { playSfx } from '../services/soundEffects';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface FlashcardsViewProps {
  currentTopic: string;
  stats: UserStats;
  onUpdateStats: (newStats: UserStats) => void;
  onNavigateToGraph?: () => void;
  onPracticeInChat?: (topic: string) => void;
}

export const FlashcardsView: React.FC<FlashcardsViewProps> = ({
  currentTopic,
  stats,
  onUpdateStats,
  onNavigateToGraph,
  onPracticeInChat,
}) => {
  const activeTheme: LanguageThemeConfig = getLanguageTheme(stats.idioma_ativo || currentTopic);

  // Estados dos Flashcards
  const [cards, setCards] = useState<SRSFlashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [filterMode, setFilterMode] = useState<FlashcardFilterMode>('todos');
  const [invertMode, setInvertMode] = useState(false); // Inverter: Significado ➔ Termo
  const [direction, setDirection] = useState<'next' | 'prev' | 'flip'>('next');
  const [autoPronounce, setAutoPronounce] = useState(true); // Pronúncia automática ao exibir o cartão
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Histórico da Sessão
  const [sessionResults, setSessionResults] = useState<SRSReviewResult[]>([]);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<FlashcardSessionSummary | null>(null);

  // Treinamento por Voz
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);

  // Função para tocar pronúncia do cartão
  const playCardAudio = useCallback((cardTerm?: string) => {
    const termToSpeak = cardTerm || cards[currentIndex]?.termo;
    if (!termToSpeak) return;
    setIsPlayingAudio(true);
    SpeechService.speak(termToSpeak, {
      lang: activeTheme.codigo_voz,
      rate: 0.9,
    });
    const timer = setTimeout(() => {
      setIsPlayingAudio(false);
    }, 1600);
    return () => clearTimeout(timer);
  }, [cards, currentIndex, activeTheme.codigo_voz]);

  // Carrega Flashcards do Grafo de Memória
  const loadCards = useCallback(() => {
    const loaded = FlashcardsEngine.getFlashcardsFromGraph(
      stats.idioma_ativo || currentTopic,
      filterMode
    );
    setCards(loaded);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionResults([]);
    setIsSessionCompleted(false);
    setSessionSummary(null);
    setTranscribedText('');
  }, [stats.idioma_ativo, currentTopic, filterMode]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Efeito de Áudio Automático ao exibir um novo flashcard
  useEffect(() => {
    if (!autoPronounce || cards.length === 0 || isSessionCompleted) return;
    const currentCard = cards[currentIndex];
    if (!currentCard) return;

    // Dispara a pronúncia com pequeno delay suave para sincronizar com a animação de entrada
    const timer = setTimeout(() => {
      playCardAudio(currentCard.termo);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentIndex, cards, autoPronounce, isSessionCompleted, playCardAudio]);

  // Embaralhar Deck
  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // Virar a Carta
  const handleFlip = () => {
    playSfx('card_flip');
    setIsFlipped((prev) => {
      const nextState = !prev;
      return nextState;
    });
  };

  // Avaliação no Modelo de Repetição Espaçada (SRS)
  const handleGrade = (grade: SRSGrade) => {
    if (cards.length === 0 || currentIndex >= cards.length) return;
    const currentCard = cards[currentIndex];

    if (grade >= 3) {
      playSfx('success');
    } else {
      playSfx('error');
    }

    // Processa a revisão no motor SRS
    const { result, updatedCard, updatedStats, repeatInSession } = FlashcardsEngine.processReview(
      currentCard,
      grade,
      stats
    );

    // Atualiza estatísticas globais
    onUpdateStats(updatedStats);

    // Registra resultado
    const updatedResults = [...sessionResults, result];
    setSessionResults(updatedResults);

    // Se errou (grade 1), reinserir no final da fila da sessão atual para fixação
    let nextCards = [...cards];
    nextCards[currentIndex] = updatedCard;
    if (repeatInSession) {
      nextCards.push({
        ...updatedCard,
        id: `${updatedCard.id}-repeat-${Date.now()}`,
      });
    }
    setCards(nextCards);

    // Feedback sonoro da pronúncia do termo
    if (grade >= 3) {
      SpeechService.speak(currentCard.termo, {
        lang: activeTheme.codigo_voz,
        rate: 0.95,
      });
    }

    // Avança para a próxima carta ou finaliza
    if (currentIndex + 1 < nextCards.length) {
      setDirection('next');
      setIsFlipped(false);
      setTranscribedText('');
      setCurrentIndex((prev) => prev + 1);
    } else {
      finishSession(updatedResults, nextCards);
    }
  };

  // Finalização da Sessão de Flashcards
  const finishSession = (results: SRSReviewResult[], allCards: SRSFlashcard[]) => {
    const novamenteCount = results.filter((r) => r.grade === 1).length;
    const dificilCount = results.filter((r) => r.grade === 2).length;
    const bomCount = results.filter((r) => r.grade === 3).length;
    const facilCount = results.filter((r) => r.grade === 4).length;
    const xpGanhoTotal = results.reduce((acc, r) => acc + r.xp_ganho, 0);

    const dominadosCount = allCards.filter((c) => c.dominio_atual >= 80).length;
    const dominioMedio =
      Math.round(allCards.reduce((acc, c) => acc + c.dominio_atual, 0) / Math.max(1, allCards.length));

    const summary: FlashcardSessionSummary = {
      totalCards: results.length,
      revisados: results.length,
      novamenteCount,
      dificilCount,
      bomCount,
      facilCount,
      xpGanhoTotal,
      dominioMedioFinal: dominioMedio,
      cartasDominadasHoje: dominadosCount,
    };

    setSessionSummary(summary);
    setIsSessionCompleted(true);

    // Confetti comemorativo
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.6 },
    });
  };

  // Atalhos de Teclado (Espaço para virar, 1, 2, 3, 4 para classificar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignora se estiver digitando em input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        handleFlip();
      } else if (isFlipped) {
        if (e.key === '1') handleGrade(1);
        else if (e.key === '2') handleGrade(2);
        else if (e.key === '3') handleGrade(3);
        else if (e.key === '4') handleGrade(4);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentIndex, cards]);

  // Gravação de Áudio para Treinar Pronúncia
  const handleStartVoice = async () => {
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorderService();
      }
      await audioRecorderRef.current.startRecording();
      setIsRecording(true);
    } catch (err) {
      console.warn('Erro ao acessar microfone:', err);
    }
  };

  const handleStopVoice = async () => {
    if (!audioRecorderRef.current || !isRecording) return;
    setIsRecording(false);
    setVoiceTranscribing(true);

    try {
      const result = await audioRecorderRef.current.stopRecordingAndTranscribe(
        activeTheme.codigo_voz || 'en-US'
      );
      setVoiceTranscribing(false);
      if (result.text) {
        setTranscribedText(result.text.trim());
      }
    } catch (err) {
      setVoiceTranscribing(false);
      console.warn('Erro ao transcrever:', err);
    }
  };

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? Math.round(((currentIndex + 1) / cards.length) * 100) : 0;

  return (
    <div className="view-card p-5 sm:p-7 md:p-8 space-y-6 max-w-4xl mx-auto w-full text-left">
      {/* Cabeçalho de Controle e Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center font-bold shadow-xs border border-[var(--border)]"
          >
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight text-[var(--fg)]">
                Flashcards de Repetição Espaçada
              </h2>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)] uppercase font-bold text-[var(--fg)]">
                {activeTheme.bandeira} {activeTheme.nome}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Algoritmo SM-2 otimizado com base nos termos e erros do seu Grafo de Memória
            </p>
          </div>
        </div>

        {/* Controles de Modo e Deck */}
        <div className="flex items-center space-x-2">
          {/* Botão de Áudio Automático */}
          <button
            onClick={() => setAutoPronounce((prev) => !prev)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              autoPronounce
                ? 'bg-[var(--accent)] text-[var(--fg)] border-[var(--border)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)]'
            }`}
            title="Tocar a pronúncia nativa automaticamente ao exibir cada cartão"
          >
            <Volume2 className={`w-3.5 h-3.5 ${autoPronounce ? 'text-[var(--fg)] animate-pulse' : 'text-[var(--muted)]'}`} />
            <span className="hidden sm:inline">Som Automático: {autoPronounce ? 'ON' : 'OFF'}</span>
            <span className="sm:hidden font-mono">{autoPronounce ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setInvertMode((prev) => !prev)}
            className={`px-3 py-1.5 rounded-full border text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
              invertMode
                ? 'bg-[var(--fg)] text-[var(--accent)] border-[var(--fg)] shadow-xs'
                : 'bg-[var(--surface)] text-[var(--fg)] border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)]'
            }`}
            title="Inverter ordem: Significado primeiro ➔ Termo"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Modo Invertido</span>
          </button>

          <button
            onClick={handleShuffle}
            className="p-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] transition cursor-pointer"
            title="Embaralhar Flashcards"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={loadCards}
            className="p-2 rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] transition cursor-pointer"
            title="Recarregar do Grafo de Memória"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
        <span className="text-[var(--muted)] uppercase text-[10px] font-extrabold tracking-wider flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3" /> Filtro:
        </span>

        <button
          onClick={() => setFilterMode('todos')}
          className={`px-3.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap text-xs font-bold ${
            filterMode === 'todos'
              ? 'bg-[var(--fg)] text-[var(--bg)] border-[var(--fg)]'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)]'
          }`}
        >
          🎯 Todos ({cards.length})
        </button>

        <button
          onClick={() => setFilterMode('criticos')}
          className={`px-3.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap text-xs font-bold ${
            filterMode === 'criticos'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:bg-[oklch(0.96_0.01_84)] hover:text-rose-600'
          }`}
        >
          🚨 Críticos / Baixo Domínio
        </button>

        <button
          onClick={() => setFilterMode('falsos_amigos')}
          className={`px-3.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap text-xs font-bold ${
            filterMode === 'falsos_amigos'
              ? 'bg-[var(--sunny)] text-[var(--fg)] border-amber-400 font-extrabold'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:bg-[oklch(0.96_0.01_84)] hover:text-amber-800'
          }`}
        >
          🎭 Falsos Amigos
        </button>

        <button
          onClick={() => setFilterMode('expressoes')}
          className={`px-3.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap text-xs font-bold ${
            filterMode === 'expressoes'
              ? 'bg-[var(--sky)] text-sky-950 border-sky-300 font-extrabold'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:bg-[oklch(0.96_0.01_84)] hover:text-[var(--fg)]'
          }`}
        >
          🗣️ Expressões & Gírias
        </button>

        <button
          onClick={() => setFilterMode('vencidos_hoje')}
          className={`px-3.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap text-xs font-bold ${
            filterMode === 'vencidos_hoje'
              ? 'bg-[var(--mint)] text-[var(--ok)] border-[var(--ok)]/40 font-extrabold'
              : 'bg-[var(--surface)] border-[var(--border)] text-[var(--muted)] hover:bg-[oklch(0.96_0.01_84)] hover:text-[var(--ok)]'
          }`}
        >
          📅 Vencidos para Hoje (SRS)
        </button>
      </div>

      {/* TELA DE CONCLUSÃO / RESUMO DA SESSÃO */}
      {isSessionCompleted && sessionSummary ? (
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] text-[var(--fg)] flex items-center justify-center mx-auto shadow-xs border border-[var(--border)]">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-display font-bold tracking-tight text-[var(--fg)]">
              Sessão de Flashcards Concluída!
            </h3>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              O agendamento de repetição espaçada foi recalculado e sincronizado com o Grafo de Memória.
            </p>
          </div>

          {/* Grid de Estatísticas Finais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full text-xs">
            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">CARTÕES REVISADOS</span>
              <span className="text-2xl font-display font-extrabold text-[var(--fg)] font-mono">{sessionSummary.revisados}</span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">DOMÍNIO MÉDIO</span>
              <span className="text-2xl font-display font-extrabold text-[var(--ok)] font-mono">
                {sessionSummary.dominioMedioFinal}%
              </span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">DOMINADOS HOJE</span>
              <span className="text-2xl font-display font-extrabold text-[var(--fg)] font-mono">
                {sessionSummary.cartasDominadasHoje} 🏆
              </span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">XP OBTIDO</span>
              <span className="text-2xl font-display font-extrabold text-[var(--ok)] font-mono">+{sessionSummary.xpGanhoTotal} XP</span>
            </div>
          </div>

          {/* Breakdown de Respostas SRS */}
          <div className="p-5 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] w-full text-left text-xs space-y-2.5 shadow-xs">
            <span className="text-[var(--muted)] font-extrabold uppercase text-[10px] block">
              Distribuição de Avaliações SRS:
            </span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
                <span className="block text-[10px] font-bold uppercase">Novamente</span>
                <span className="text-lg font-mono font-extrabold">{sessionSummary.novamenteCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--sunny)] border border-amber-300 text-amber-900">
                <span className="block text-[10px] font-bold uppercase">Difícil</span>
                <span className="text-lg font-mono font-extrabold">{sessionSummary.dificilCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[var(--mint)] border border-[var(--ok)]/30 text-[var(--ok)]">
                <span className="block text-[10px] font-bold uppercase">Bom</span>
                <span className="text-lg font-mono font-extrabold">{sessionSummary.bomCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-[var(--fg)]">
                <span className="block text-[10px] font-bold uppercase">Fácil</span>
                <span className="text-lg font-mono font-extrabold">{sessionSummary.facilCount}</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              variant="default"
              onClick={loadCards}
              className="font-bold text-xs cursor-pointer gap-1.5 rounded-full"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>REPETIR SESSÃO</span>
            </Button>

            {onPracticeInChat && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPracticeInChat(currentTopic)}
                className="font-bold text-xs cursor-pointer gap-1.5 border-[var(--border)] rounded-full"
              >
                <Headphones className="w-4 h-4 text-[var(--fg)]" />
                <span>Praticar com Tutor</span>
              </Button>
            )}

            {onNavigateToGraph && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onNavigateToGraph}
                className="font-bold text-xs cursor-pointer gap-1.5 text-[var(--muted)] hover:text-[var(--fg)] rounded-full"
              >
                <Brain className="w-4 h-4" />
                <span>Ver Grafo de Memória</span>
              </Button>
            )}
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-[var(--muted)] stroke-1" />
          <h3 className="text-base font-display font-bold text-[var(--fg)]">
            Nenhum cartão encontrado para este filtro
          </h3>
          <p className="text-xs text-[var(--muted)] max-w-md">
            Experimente selecionar "🎯 Todos" ou interaja no chat para que o Grafo de Memória mapeie novos termos.
          </p>
          <Button onClick={() => setFilterMode('todos')} size="sm" variant="default" className="rounded-full font-bold">
            Mostrar Todos os Cartões
          </Button>
        </div>
      ) : (
        /* ÁREA PRINCIPAL DO FLASHCARD INTERATIVO COM FRAMER MOTION */
        <div className="flex-1 flex flex-col justify-between items-center w-full space-y-4">
          {/* Barra de Progresso Superior */}
          <div className="w-full flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[var(--muted)] font-bold">Progresso:</span>
              <span className="font-mono font-extrabold text-[var(--fg)]">
                {currentIndex + 1} / {cards.length}
              </span>
              <span className="text-[11px] text-[var(--muted)] font-mono">({progressPercent}%)</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-[var(--muted)] text-[11px] hidden sm:inline">
                Domínio: <strong className="text-[var(--fg)] font-bold font-mono">{currentCard?.dominio_atual}%</strong>
              </span>
              <div className="w-24 h-2 bg-[oklch(0.94_0.01_84)] rounded-full overflow-hidden border border-[var(--border)]">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    (currentCard?.dominio_atual || 0) >= 80
                      ? 'bg-[var(--ok)]'
                      : (currentCard?.dominio_atual || 0) >= 50
                      ? 'bg-[var(--sunny)]'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${currentCard?.dominio_atual || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* PALCO 3D COM FRAMER MOTION */}
          <div className="relative w-full max-w-xl h-[360px] sm:h-[400px] flex items-center justify-center [perspective:1200px]">
            {/* Cartas em pilha no fundo para profundidade visual */}
            <div className="absolute inset-0 max-w-xl mx-auto rounded-[var(--r-lg)] border border-[var(--border)] bg-[oklch(0.96_0.01_84)] -rotate-2 translate-y-3 scale-95 pointer-events-none" />
            <div className="absolute inset-0 max-w-xl mx-auto rounded-[var(--r-lg)] border border-[var(--border)] bg-[oklch(0.97_0.01_84)] rotate-1 translate-y-1.5 scale-98 pointer-events-none" />

            <AnimatePresence mode="wait">
              <motion.div
                key={currentCard.id}
                initial={{ opacity: 0, scale: 0.92, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.92, y: -15 }}
                transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                className="relative w-full h-full cursor-pointer [transform-style:preserve-3d]"
                onClick={handleFlip}
              >
                <motion.div
                  className="w-full h-full relative [transform-style:preserve-3d] transition-all duration-500"
                  animate={{ rotateY: isFlipped ? 180 : 0 }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                >
                  {/* FACE 1: FRENTE DO FLASHCARD */}
                  <div className="absolute inset-0 w-full h-full bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 sm:p-7 shadow-md flex flex-col justify-between [backface-visibility:hidden]">
                    {/* Topo da Carta: Tags & Pronúncia */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{activeTheme.bandeira.split(' ')[0]}</span>
                        <span className="text-[11px] px-3 py-0.5 rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)] text-[var(--fg)] uppercase font-bold">
                          {currentCard.tipo.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 text-[11px] text-[var(--muted)]">
                        <Flame className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                        <span className="font-bold text-[var(--fg)]">SRS {currentCard.status_srs}</span>
                      </div>
                    </div>

                    {/* Conteúdo Central da Frente */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-2">
                      {/* Badge dinâmico de reprodução de áudio */}
                      {isPlayingAudio && (
                        <div className="px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-stone-900 dark:text-stone-100 text-[11px] font-bold flex items-center space-x-1.5 animate-pulse">
                          <Volume2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          <span>🔊 Pronúncia automática ativa — ouça e repita em seguida!</span>
                        </div>
                      )}

                      <div className="flex items-center justify-center space-x-3">
                        <h3 className="text-2xl sm:text-4xl font-display font-extrabold tracking-tight text-[var(--fg)]">
                          {invertMode ? currentCard.traducao : currentCard.termo}
                        </h3>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playCardAudio(currentCard.termo);
                          }}
                          className={`p-2.5 rounded-full transition cursor-pointer ${
                            isPlayingAudio
                              ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 scale-110 shadow-sm border border-amber-400'
                              : 'hover:bg-[oklch(0.96_0.01_84)] text-[var(--muted)] hover:text-[var(--fg)] border border-transparent'
                          }`}
                          title="Ouvir pronúncia nativa novamente"
                        >
                          <Volume2 className="w-5 h-5" />
                        </button>
                      </div>

                      {/* Transcrição IPA */}
                      {currentCard.pronuncia_ipa && !invertMode && (
                        <p className="text-xs sm:text-sm font-mono text-[var(--muted)]">
                          IPA: {currentCard.pronuncia_ipa}
                        </p>
                      )}

                      {/* Alerta de Dica ou Falso Amigo */}
                      {currentCard.dica_mnemonica && (
                        <div className="p-3 rounded-2xl bg-[var(--mint)] border border-[var(--ok)]/30 text-[var(--fg)] text-xs max-w-sm font-medium">
                          💡 {currentCard.dica_mnemonica}
                        </div>
                      )}
                    </div>

                    {/* Rodapé da Frente: Dica de Virar e Treino de Voz */}
                    <div className="border-t border-[var(--border)] pt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            isRecording ? handleStopVoice() : handleStartVoice();
                          }}
                          disabled={voiceTranscribing}
                          className={`px-3 py-1.5 rounded-full border flex items-center space-x-1.5 cursor-pointer transition text-xs font-bold ${
                            isRecording
                              ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                              : voiceTranscribing
                              ? 'bg-[oklch(0.96_0.01_84)] text-[var(--muted)] border-[var(--border)]'
                              : 'bg-[var(--surface)] hover:bg-[oklch(0.96_0.01_84)] text-[var(--fg)] border-[var(--border)]'
                          }`}
                          title="Falar em voz alta para testar pronúncia antes de virar"
                        >
                          {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          <span className="text-[11px] hidden sm:inline">
                            {isRecording ? 'Gravando...' : voiceTranscribing ? 'Transcrevendo...' : '🎙️ Repetir & Testar'}
                          </span>
                        </button>

                        {transcribedText && (
                          <span className="text-[11px] text-[var(--ok)] font-bold truncate max-w-[150px]">
                            "{transcribedText}"
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 text-[var(--muted)] font-bold">
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Clique para virar & ver resposta</span>
                      </div>
                    </div>
                  </div>

                  {/* FACE 2: VERSO DO FLASHCARD (RESPOSTA E CONTEXTO) */}
                  <div className="absolute inset-0 w-full h-full bg-[var(--surface)] border-2 border-[var(--accent-deep)] rounded-[var(--r-lg)] p-6 sm:p-7 shadow-xl flex flex-col justify-between [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    {/* Topo do Verso */}
                    <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                      <span className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-[var(--ok)]" />
                        <span>Significado & Contexto</span>
                      </span>

                      <span className="text-[10px] font-mono text-[var(--muted)] font-bold">
                        Próx. revisão: +{currentCard.intervalo_dias}d
                      </span>
                    </div>

                    {/* Conteúdo Central do Verso */}
                    <div className="flex-1 flex flex-col justify-center space-y-3.5 text-left py-2">
                      <div>
                        <span className="text-[10px] uppercase font-extrabold tracking-wider text-[var(--muted)] block">
                          Tradução Principal:
                        </span>
                        <h4 className="text-xl sm:text-2xl font-display font-extrabold text-[var(--fg)]">
                          {invertMode ? currentCard.termo : currentCard.traducao}
                        </h4>
                      </div>

                      {/* Explicação Pedagógica */}
                      <div className="p-3 rounded-2xl bg-[oklch(0.96_0.01_84)] border border-[var(--border)] text-xs text-[var(--fg)] space-y-1">
                        <span className="text-[10px] font-extrabold text-[var(--fg)] block uppercase">
                          💡 Detalhes do Grafo de Memória:
                        </span>
                        <p className="leading-relaxed text-[var(--fg)]">
                          {currentCard.explicacao}
                        </p>
                      </div>

                      {/* Exemplo de Frase no Contexto com Áudio */}
                      {currentCard.exemplo_uso && (
                        <div className="pt-2 border-t border-[var(--border)] flex items-start justify-between gap-2">
                          <div className="space-y-0.5 text-xs">
                            <span className="text-[10px] text-[var(--muted)] block font-bold">Exemplo:</span>
                            <p className="text-[var(--fg)] italic font-medium">"{currentCard.exemplo_uso}"</p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              SpeechService.speak(currentCard.exemplo_uso || '', {
                                lang: activeTheme.codigo_voz,
                                rate: 1.0,
                              });
                            }}
                            className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer shrink-0"
                            title="Ouvir frase completa"
                          >
                            <Volume2 className="w-4 h-4 text-[var(--fg)]" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Verso */}
                    <div className="border-t border-[var(--border)] pt-2 flex items-center justify-between text-[11px] text-[var(--muted)]">
                      <span>Avalie seu nível de retenção abaixo:</span>
                      <span className="text-[var(--fg)] font-bold font-mono">[1 - 4]</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* BOTÕES DE AVALIAÇÃO SRS (APARECEM QUANDO VIRADO OU EM QUALQUER MOMENTO) */}
          <div className="w-full max-w-xl space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* 1: Novamente (Again) */}
              <button
                onClick={() => handleGrade(1)}
                className="p-3 rounded-2xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group shadow-2xs"
                title="Não lembrei da resposta (Repetir nesta sessão)"
              >
                <div className="flex items-center space-x-1">
                  <XCircle className="w-3.5 h-3.5 text-rose-600" />
                  <span>Novamente</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal font-mono">&lt; 1 min [1]</span>
              </button>

              {/* 2: Difícil (Hard) */}
              <button
                onClick={() => handleGrade(2)}
                className="p-3 rounded-2xl border border-amber-300 bg-[var(--sunny)] hover:bg-amber-100 text-amber-900 text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group shadow-2xs"
                title="Lembrei com hesitação ou esforço"
              >
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                  <span>Difícil</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal font-mono">1 dia [2]</span>
              </button>

              {/* 3: Bom (Good) */}
              <button
                onClick={() => handleGrade(3)}
                className="p-3 rounded-2xl border border-[var(--ok)]/30 bg-[var(--mint)] hover:bg-[var(--accent)] text-[var(--ok)] text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group shadow-2xs"
                title="Resposta correta e tempo adequado"
              >
                <div className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)]" />
                  <span>Bom</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal font-mono">3 dias [3]</span>
              </button>

              {/* 4: Fácil (Easy) */}
              <button
                onClick={() => handleGrade(4)}
                className="p-3 rounded-2xl border border-[var(--border)] bg-[oklch(0.96_0.01_84)] hover:bg-[var(--fg)] hover:text-[var(--accent)] text-[var(--fg)] text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group shadow-2xs"
                title="Domínio imediato e seguro"
              >
                <div className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                  <span>Fácil</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal font-mono">7 dias [4]</span>
              </button>
            </div>

            {/* Dica de Navegação Rápida */}
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)] px-1">
              <span>💡 Dica: [Espaço] para virar carta, [1-4] para avaliar retenção.</span>
              <button
                onClick={handleFlip}
                className="underline hover:text-[var(--fg)] cursor-pointer font-bold"
              >
                {isFlipped ? 'Mostrar Frente' : 'Mostrar Verso'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

