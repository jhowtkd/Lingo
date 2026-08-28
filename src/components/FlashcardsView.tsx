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

  // Histórico da Sessão
  const [sessionResults, setSessionResults] = useState<SRSReviewResult[]>([]);
  const [isSessionCompleted, setIsSessionCompleted] = useState(false);
  const [sessionSummary, setSessionSummary] = useState<FlashcardSessionSummary | null>(null);

  // Treinamento por Voz
  const [isRecording, setIsRecording] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [voiceTranscribing, setVoiceTranscribing] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);

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

  // Embaralhar Deck
  const handleShuffle = () => {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  // Virar a Carta
  const handleFlip = () => {
    setIsFlipped((prev) => {
      const nextState = !prev;
      // Se virou para o verso e tem exemplo, ouve pronúncia se desejar
      return nextState;
    });
  };

  // Avaliação no Modelo de Repetição Espaçada (SRS)
  const handleGrade = (grade: SRSGrade) => {
    if (cards.length === 0 || currentIndex >= cards.length) return;
    const currentCard = cards[currentIndex];

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
    <div className="flex flex-col h-full space-y-4 max-w-4xl mx-auto w-full">
      {/* Cabeçalho de Controle e Filtros */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-md ${
              activeTheme.button_class.split(' ')[0]
            }`}
          >
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Flashcards de Repetição Espaçada
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${activeTheme.badge_class}`}>
                {activeTheme.bandeira} {activeTheme.nome}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Algoritmo SM-2 otimizado com base nos termos e erros do seu Grafo de Memória
            </p>
          </div>
        </div>

        {/* Controles de Modo e Deck */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setInvertMode((prev) => !prev)}
            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition flex items-center space-x-1 cursor-pointer ${
              invertMode
                ? 'bg-foreground text-background border-foreground font-bold shadow-2xs'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
            title="Inverter ordem: Significado primeiro ➔ Termo"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Modo Invertido</span>
          </button>

          <button
            onClick={handleShuffle}
            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Embaralhar Flashcards"
          >
            <Shuffle className="w-4 h-4" />
          </button>

          <button
            onClick={loadCards}
            className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Recarregar do Grafo de Memória"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barra de Filtros Rápidos */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none text-xs font-mono">
        <span className="text-muted-foreground uppercase text-[10px] tracking-wider flex items-center gap-1 mr-1">
          <Filter className="w-3 h-3" /> Filtro:
        </span>

        <button
          onClick={() => setFilterMode('todos')}
          className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
            filterMode === 'todos'
              ? 'bg-foreground text-background border-foreground font-bold'
              : 'bg-card/70 border-border text-muted-foreground hover:bg-muted hover:text-foreground'
          }`}
        >
          🎯 Todos ({cards.length})
        </button>

        <button
          onClick={() => setFilterMode('criticos')}
          className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
            filterMode === 'criticos'
              ? 'bg-red-600 text-white border-red-600 font-bold'
              : 'bg-card/70 border-border text-muted-foreground hover:bg-muted hover:text-red-500'
          }`}
        >
          🚨 Críticos / Baixo Domínio
        </button>

        <button
          onClick={() => setFilterMode('falsos_amigos')}
          className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
            filterMode === 'falsos_amigos'
              ? 'bg-amber-600 text-white border-amber-600 font-bold'
              : 'bg-card/70 border-border text-muted-foreground hover:bg-muted hover:text-amber-500'
          }`}
        >
          🎭 Falsos Amigos
        </button>

        <button
          onClick={() => setFilterMode('expressoes')}
          className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
            filterMode === 'expressoes'
              ? 'bg-purple-600 text-white border-purple-600 font-bold'
              : 'bg-card/70 border-border text-muted-foreground hover:bg-muted hover:text-purple-500'
          }`}
        >
          🗣️ Expressões & Gírias
        </button>

        <button
          onClick={() => setFilterMode('vencidos_hoje')}
          className={`px-2.5 py-1 rounded-full border transition cursor-pointer whitespace-nowrap ${
            filterMode === 'vencidos_hoje'
              ? 'bg-blue-600 text-white border-blue-600 font-bold'
              : 'bg-card/70 border-border text-muted-foreground hover:bg-muted hover:text-blue-500'
          }`}
        >
          📅 Vencidos para Hoje (SRS)
        </button>
      </div>

      {/* TELA DE CONCLUSÃO / RESUMO DA SESSÃO */}
      {isSessionCompleted && sessionSummary ? (
        <div className="flex-1 flex flex-col justify-center items-center p-6 text-center max-w-2xl mx-auto space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Sessão de Flashcards Concluída!
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono">
              O agendamento de repetição espaçada foi recalculado e sincronizado com o Grafo de Memória.
            </p>
          </div>

          {/* Grid de Estatísticas Finais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full font-mono text-xs">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">CARTÕES REVISADOS</span>
              <span className="text-lg font-bold text-foreground">{sessionSummary.revisados}</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">DOMÍNIO MÉDIO</span>
              <span className="text-lg font-bold text-emerald-500">
                {sessionSummary.dominioMedioFinal}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">DOMINADOS HOJE</span>
              <span className="text-lg font-bold text-amber-500">
                {sessionSummary.cartasDominadasHoje} 🏆
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">XP OBTIDO</span>
              <span className="text-lg font-bold text-blue-500">+{sessionSummary.xpGanhoTotal} XP</span>
            </div>
          </div>

          {/* Breakdown de Respostas SRS */}
          <div className="p-4 rounded-xl border border-border bg-card w-full text-left font-mono text-xs space-y-2">
            <span className="text-muted-foreground font-bold uppercase text-[10px] block">
              Distribuição de Avaliações SRS:
            </span>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-600">
                <span className="block text-[10px] font-bold">Novamente</span>
                <span className="text-base font-extrabold">{sessionSummary.novamenteCount}</span>
              </div>
              <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-600">
                <span className="block text-[10px] font-bold">Difícil</span>
                <span className="text-base font-extrabold">{sessionSummary.dificilCount}</span>
              </div>
              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
                <span className="block text-[10px] font-bold">Bom</span>
                <span className="text-base font-extrabold">{sessionSummary.bomCount}</span>
              </div>
              <div className="p-2 rounded bg-blue-500/10 border border-blue-500/30 text-blue-600">
                <span className="block text-[10px] font-bold">Fácil</span>
                <span className="text-base font-extrabold">{sessionSummary.facilCount}</span>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              onClick={loadCards}
              className={`font-mono text-xs font-bold cursor-pointer gap-1.5 ${activeTheme.button_class}`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>REPETIR SESSÃO</span>
            </Button>

            {onPracticeInChat && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPracticeInChat(currentTopic)}
                className="font-mono text-xs cursor-pointer gap-1.5 border-border"
              >
                <Headphones className="w-4 h-4" />
                <span>Praticar com Tutor</span>
              </Button>
            )}

            {onNavigateToGraph && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onNavigateToGraph}
                className="font-mono text-xs cursor-pointer gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <Brain className="w-4 h-4" />
                <span>Ver Grafo de Memória</span>
              </Button>
            )}
          </div>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <BookOpen className="w-12 h-12 text-muted-foreground stroke-1" />
          <h3 className="text-base font-bold text-foreground">
            Nenhum cartão encontrado para este filtro
          </h3>
          <p className="text-xs text-muted-foreground font-mono max-w-md">
            Experimente selecionar "🎯 Todos" ou interaja no chat para que o Grafo de Memória mapeie novos termos.
          </p>
          <Button onClick={() => setFilterMode('todos')} size="sm">
            Mostrar Todos os Cartões
          </Button>
        </div>
      ) : (
        /* ÁREA PRINCIPAL DO FLASHCARD INTERATIVO COM FRAMER MOTION */
        <div className="flex-1 flex flex-col justify-between items-center w-full space-y-4">
          {/* Barra de Progresso Superior */}
          <div className="w-full flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2">
              <span className="text-muted-foreground">Progresso:</span>
              <span className="font-bold text-foreground">
                {currentIndex + 1} / {cards.length}
              </span>
              <span className="text-[11px] text-muted-foreground">({progressPercent}%)</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-muted-foreground text-[11px] hidden sm:inline">
                Domínio: <strong className="text-foreground">{currentCard?.dominio_atual}%</strong>
              </span>
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden border border-border">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    (currentCard?.dominio_atual || 0) >= 80
                      ? 'bg-emerald-500'
                      : (currentCard?.dominio_atual || 0) >= 50
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: `${currentCard?.dominio_atual || 0}%` }}
                />
              </div>
            </div>
          </div>

          {/* PALCO 3D COM FRAMER MOTION */}
          <div className="relative w-full max-w-xl h-[360px] sm:h-[400px] flex items-center justify-center [perspective:1200px]">
            {/* Cartas em pilha no fundo para profundidade visual */}
            <div className="absolute inset-0 max-w-xl mx-auto rounded-2xl border border-border/40 bg-card/30 -rotate-2 translate-y-3 scale-95 pointer-events-none" />
            <div className="absolute inset-0 max-w-xl mx-auto rounded-2xl border border-border/60 bg-card/60 rotate-1 translate-y-1.5 scale-98 pointer-events-none" />

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
                  <div className="absolute inset-0 w-full h-full bg-card border border-border/80 rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col justify-between [backface-visibility:hidden]">
                    {/* Topo da Carta: Tags & Pronúncia */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-base">{activeTheme.bandeira.split(' ')[0]}</span>
                        <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-border/80 bg-secondary text-muted-foreground uppercase font-semibold">
                          {currentCard.tipo.replace('_', ' ')}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 text-[11px] text-muted-foreground">
                        <Flame className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-medium">SRS {currentCard.status_srs}</span>
                      </div>
                    </div>

                    {/* Conteúdo Central da Frente */}
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-2">
                      <div className="flex items-center justify-center space-x-3">
                        <h3 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-foreground">
                          {invertMode ? currentCard.traducao : currentCard.termo}
                        </h3>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            SpeechService.speak(currentCard.termo, {
                              lang: activeTheme.codigo_voz,
                              rate: 0.9,
                            });
                          }}
                          className="p-2.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Ouvir pronúncia nativa"
                        >
                          <Volume2 className="w-5 h-5 text-foreground" />
                        </button>
                      </div>

                      {/* Transcrição IPA */}
                      {currentCard.pronuncia_ipa && !invertMode && (
                        <p className="text-xs sm:text-sm font-mono text-muted-foreground">
                          IPA: {currentCard.pronuncia_ipa}
                        </p>
                      )}

                      {/* Alerta de Dica ou Falso Amigo */}
                      {currentCard.dica_mnemonica && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs max-w-sm">
                          💡 {currentCard.dica_mnemonica}
                        </div>
                      )}
                    </div>

                    {/* Rodapé da Frente: Dica de Virar e Treino de Voz */}
                    <div className="border-t border-border/60 pt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            isRecording ? handleStopVoice() : handleStartVoice();
                          }}
                          disabled={voiceTranscribing}
                          className={`p-2 rounded-xl border flex items-center space-x-1.5 cursor-pointer transition text-xs font-semibold ${
                            isRecording
                              ? 'bg-red-600 text-white border-red-600 animate-pulse'
                              : voiceTranscribing
                              ? 'bg-secondary text-muted-foreground border-border'
                              : 'bg-card hover:bg-secondary text-foreground border-border/80'
                          }`}
                          title="Falar em voz alta para testar pronúncia antes de virar"
                        >
                          {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                          <span className="text-[11px] hidden sm:inline">
                            {isRecording ? 'Gravando...' : voiceTranscribing ? 'Transcrevendo...' : 'Testar Voz'}
                          </span>
                        </button>

                        {transcribedText && (
                          <span className="text-[11px] text-emerald-600 font-semibold truncate max-w-[150px]">
                            "{transcribedText}"
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-1 text-muted-foreground">
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Clique para virar</span>
                      </div>
                    </div>
                  </div>

                  {/* FACE 2: VERSO DO FLASHCARD (RESPOSTA E CONTEXTO) */}
                  <div className="absolute inset-0 w-full h-full bg-card border border-primary/30 rounded-3xl p-6 sm:p-7 shadow-xl flex flex-col justify-between [transform:rotateY(180deg)] [backface-visibility:hidden]">
                    {/* Topo do Verso */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-3">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        <span>Significado & Contexto</span>
                      </span>

                      <span className="text-[10px] font-mono text-muted-foreground">
                        Próx. revisão: +{currentCard.intervalo_dias}d
                      </span>
                    </div>

                    {/* Conteúdo Central do Verso */}
                    <div className="flex-1 flex flex-col justify-center space-y-3.5 text-left py-2">
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                          Tradução Principal:
                        </span>
                        <h4 className="text-xl sm:text-2xl font-bold text-foreground">
                          {invertMode ? currentCard.termo : currentCard.traducao}
                        </h4>
                      </div>

                      {/* Explicação Pedagógica */}
                      <div className="p-2.5 rounded-lg bg-muted/50 border border-border text-xs font-mono text-muted-foreground space-y-1">
                        <span className="text-[10px] font-bold text-foreground block uppercase">
                          💡 Detalhes do Grafo de Memória:
                        </span>
                        <p className="leading-relaxed text-foreground/90">
                          {currentCard.explicacao}
                        </p>
                      </div>

                      {/* Exemplo de Frase no Contexto com Áudio */}
                      {currentCard.exemplo_uso && (
                        <div className="pt-2 border-t border-border/60 flex items-start justify-between gap-2">
                          <div className="space-y-0.5 font-mono text-xs">
                            <span className="text-[10px] text-muted-foreground block">Exemplo:</span>
                            <p className="text-foreground italic font-medium">"{currentCard.exemplo_uso}"</p>
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
                            className="p-1.5 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                            title="Ouvir frase completa"
                          >
                            <Volume2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Rodapé do Verso */}
                    <div className="border-t border-border/60 pt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <span>Avalie seu nível de retenção abaixo:</span>
                      <span className="text-foreground font-bold">[1 - 4]</span>
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
                className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 font-mono text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group"
                title="Não lembrei da resposta (Repetir nesta sessão)"
              >
                <div className="flex items-center space-x-1">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span>Novamente</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal">&lt; 1 min [1]</span>
              </button>

              {/* 2: Difícil (Hard) */}
              <button
                onClick={() => handleGrade(2)}
                className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group"
                title="Lembrei com hesitação ou esforço"
              >
                <div className="flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                  <span>Difícil</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal">1 dia [2]</span>
              </button>

              {/* 3: Bom (Good) */}
              <button
                onClick={() => handleGrade(3)}
                className="p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group"
                title="Resposta correta e tempo adequado"
              >
                <div className="flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Bom</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal">3 dias [3]</span>
              </button>

              {/* 4: Fácil (Easy) */}
              <button
                onClick={() => handleGrade(4)}
                className="p-3 rounded-xl border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-mono text-xs font-bold transition flex flex-col items-center justify-center space-y-1 cursor-pointer group"
                title="Domínio imediato e seguro"
              >
                <div className="flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  <span>Fácil</span>
                </div>
                <span className="text-[10px] opacity-75 font-normal">7 dias [4]</span>
              </button>
            </div>

            {/* Dica de Navegação Rápida */}
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
              <span>💡 Dica: [Espaço] para virar carta, [1-4] para avaliar retenção.</span>
              <button
                onClick={handleFlip}
                className="underline hover:text-foreground cursor-pointer"
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
