import React, { useState, useEffect, useRef } from 'react';
import {
  Swords,
  Zap,
  Mic,
  MicOff,
  Volume2,
  Timer,
  Trophy,
  Flame,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Brain,
  Headphones,
  Award,
  AlertTriangle,
} from 'lucide-react';
import { fireConfetti as confetti } from '../lib/confetti';
import {
  DuelQuestion,
  DuelRoundAnswer,
  DuelGameSession,
  UserStats,
  LanguageThemeConfig,
} from '../types';
import { VocabDuelEngine } from '../services/vocabDuelEngine';
import { AudioRecorderService } from '../services/audioService';
import { SpeechService } from '../services/speechSynthesisService';
import { StorageService } from '../services/storage';
import { getLanguageTheme } from '../services/languageThemes';
import { playSfx } from '../services/soundEffects';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface VocabularyDuelViewProps {
  currentTopic: string;
  stats: UserStats;
  onUpdateStats: (newStats: UserStats) => void;
  onNavigateToGraph?: () => void;
  onPracticeInChat?: (topic: string) => void;
}

export const VocabularyDuelView: React.FC<VocabularyDuelViewProps> = ({
  currentTopic,
  stats,
  onUpdateStats,
  onNavigateToGraph,
  onPracticeInChat,
}) => {
  const activeTheme: LanguageThemeConfig = getLanguageTheme(stats.idioma_ativo || currentTopic);
  const activeLanguage = stats.idioma_ativo || currentTopic;
  const availableRoundCount = VocabDuelEngine.generateDuelQuestions(activeLanguage, 8).length;

  // Estados de Jogo
  const [gameState, setGameState] = useState<'lobby' | 'playing' | 'round_feedback' | 'game_over'>('lobby');
  const [questions, setQuestions] = useState<DuelQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<DuelRoundAnswer[]>([]);
  const [inputAnswer, setInputAnswer] = useState('');
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  // Modo de resposta preferido
  const [answerMode, setAnswerMode] = useState<'misto' | 'audio' | 'texto'>('misto');

  // Cronômetro da Rodada
  const [timeLeft, setTimeLeft] = useState<number>(12);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Combo
  const [currentCombo, setCurrentCombo] = useState(0);
  const [score, setScore] = useState(0);

  // Gravação de Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [audioTranscribing, setAudioTranscribing] = useState(false);
  const audioRecorderRef = useRef<AudioRecorderService | null>(null);

  // Resumo Final
  const [finalSession, setFinalSession] = useState<DuelGameSession | null>(null);
  const [xpAwarded, setXpAwarded] = useState(0);

  // Inicializa o jogo com perguntas do Grafo de Memória
  const handleStartGame = () => {
    const generated = VocabDuelEngine.generateDuelQuestions(activeLanguage, 8);
    if (generated.length === 0) return;
    setQuestions(generated);
    setCurrentIndex(0);
    setAnswers([]);
    setInputAnswer('');
    setSelectedOption(null);
    setScore(0);
    setCurrentCombo(0);
    setFinalSession(null);
    setGameState('playing');
    startQuestionTimer(generated[0].tempo_limite_segundos || 12);
  };

  // Gerenciador do Cronômetro
  const startQuestionTimer = (seconds: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(seconds);

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeOut();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Tempo Esgotado
  const handleTimeOut = () => {
    if (gameState !== 'playing') return;
    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const roundAnswer = VocabDuelEngine.evaluateAnswer(currentQ, '', 0, false, 0);
    processRoundResult(roundAnswer);
  };

  // Processamento do Envio de Resposta
  const handleSubmitAnswer = (answerText: string, isAudio = false, confidence = 0.9) => {
    if (gameState !== 'playing') return;
    if (timerRef.current) clearInterval(timerRef.current);

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    const roundAnswer = VocabDuelEngine.evaluateAnswer(
      currentQ,
      answerText,
      timeLeft,
      isAudio,
      confidence
    );

    processRoundResult(roundAnswer);
  };

  const processRoundResult = (roundAnswer: DuelRoundAnswer) => {
    if (roundAnswer.correta) {
      playSfx('success');
      setCurrentCombo((prev) => prev + 1);
      setScore((prev) => prev + roundAnswer.pontos_ganhos);
      // Efeito de som positivo ou TTS do exemplo
      const currentQ = questions[currentIndex];
      if (currentQ?.exemplo_frase) {
        SpeechService.speak(currentQ.exemplo_frase, { lang: activeTheme.codigo_voz, rate: 1.0 });
      }
    } else {
      playSfx('error');
      setCurrentCombo(0);
    }

    setAnswers((prev) => [...prev, roundAnswer]);
    setGameState('round_feedback');

    // Reproduz áudio do termo se for relevante
    const currentQ = questions[currentIndex];
    if (!roundAnswer.correta && currentQ?.termo_principal) {
      SpeechService.speak(currentQ.termo_principal, { lang: activeTheme.codigo_voz, rate: 0.9 });
    }
  };


  // Avança para a próxima pergunta ou finaliza a sessão
  const handleNextQuestion = () => {
    if (currentIndex + 1 < questions.length) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      setInputAnswer('');
      setSelectedOption(null);
      setGameState('playing');
      startQuestionTimer(questions[nextIdx].tempo_limite_segundos || 12);
    } else {
      finishGame();
    }
  };

  // Finalização do Duelo
  const finishGame = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const result = VocabDuelEngine.finishDuelSession(
      stats.idioma_ativo || currentTopic,
      answerMode,
      answers
    );
    setFinalSession(result.session);
    setXpAwarded(result.xpAwarded);
    onUpdateStats(result.updatedStats);
    setGameState('game_over');

    // Confetti comemorativo se acertou mais de 60%
    if (result.session.acertos / Math.max(1, result.session.questoes_totais) >= 0.6) {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  };

  // Gravação de Áudio via Microfone
  const handleStartVoiceRecord = async () => {
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

  const handleStopVoiceRecord = async () => {
    if (!audioRecorderRef.current || !isRecording) return;
    setIsRecording(false);
    setAudioTranscribing(true);

    try {
      const langCode = activeTheme.codigo_voz;
      const result = await audioRecorderRef.current.stopRecordingAndTranscribe(langCode);
      setAudioTranscribing(false);

      if (result.text && result.text.trim()) {
        setInputAnswer(result.text.trim());
        handleSubmitAnswer(result.text.trim(), true, result.confidence || 0.88);
      } else {
        handleSubmitAnswer('', true, 0);
      }
    } catch (err) {
      setAudioTranscribing(false);
      console.warn('Erro ao processar fala:', err);
    }
  };

  // Limpeza de timers ao desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRecorderRef.current && isRecording) {
        audioRecorderRef.current.cancelRecording();
      }
    };
  }, [isRecording]);

  const currentQuestion = questions[currentIndex];
  const lastAnswer = answers[answers.length - 1];

  // Cálculo da porcentagem do tempo restante
  const maxTime = currentQuestion?.tempo_limite_segundos || 12;
  const timePercent = Math.max(0, Math.min(100, (timeLeft / maxTime) * 100));

  return (
    <div className="view-card p-5 sm:p-7 md:p-8 space-y-6 max-w-4xl mx-auto w-full text-left">
      {/* Cabeçalho do Duelo */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[var(--border)]">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-full bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center font-bold shadow-xs border border-[var(--border)]"
          >
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-display font-bold tracking-tight text-[var(--fg)]">
                Duelo de Vocabulário
              </h2>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)] uppercase font-bold text-[var(--fg)]">
                {activeTheme.bandeira} {activeTheme.nome}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Desafios rápidos baseados no seu Grafo de Memória • Treine velocidade e precisão fonética
            </p>
          </div>
        </div>

        {/* Informações de Pontuação e Combo no Topo */}
        {gameState !== 'lobby' && (
          <div className="flex items-center space-x-3 text-xs">
            {/* Pontos */}
            <div className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <Trophy className="w-4 h-4 text-[var(--accent-deep)]" />
              <span className="font-mono font-bold text-[var(--fg)]">{score} pts</span>
            </div>

            {/* Multiplicador de Combo */}
            <div
              className={`flex items-center space-x-1 px-3.5 py-1.5 rounded-full border font-bold transition-all ${
                currentCombo > 1
                  ? 'border-[var(--ok)]/40 bg-[var(--mint)] text-[var(--ok)]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted)]'
              }`}
            >
              <Flame className={`w-4 h-4 ${currentCombo > 1 ? 'text-[var(--ok)] fill-[var(--ok)]' : ''}`} />
              <span className="font-mono">{currentCombo}x Combo</span>
            </div>

            {/* Progresso de Questões */}
            <div className="text-[var(--muted)] font-mono font-bold">
              {currentIndex + 1}/{questions.length}
            </div>
          </div>
        )}
      </div>

      {/* TELA 1: LOBBY INICIAL */}
      {gameState === 'lobby' && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-2xl mx-auto space-y-6">
          <div className="relative">
            <div
              className="w-20 h-20 rounded-2xl bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center mx-auto shadow-xs border border-[var(--border)]"
            >
              <Zap className="w-10 h-10" />
            </div>
            <span className="absolute -top-2 -right-2 text-2xl">{activeTheme.bandeira}</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--fg)]">
              Preparado para o Duelo de Velocidade?
            </h3>
            <p className="text-xs sm:text-sm text-[var(--muted)] max-w-md mx-auto leading-relaxed">
              O sistema extraiu termos com menor domínio, falsos cognatos e expressões do seu{' '}
              <span className="font-bold text-[var(--fg)]">Grafo de Memória ({activeTheme.nome})</span>.
              Responda por áudio ou texto antes do tempo esgotar para acumular combos e XP!
            </p>
          </div>

          {/* Cards de Benefícios / Regras Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left text-xs">
            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[var(--fg)]">
                <Timer className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                <span>12s por Rodada</span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Bônus de velocidade para quem responder nos primeiros segundos.
              </p>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[var(--fg)]">
                <Mic className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                <span>Bônus de Voz</span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Responder em áudio confere +30 pontos e avalia sua pronúncia.
              </p>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[var(--fg)]">
                <Brain className="w-3.5 h-3.5 text-[var(--fg)]" />
                <span>Sincroniza Grafo</span>
              </div>
              <p className="text-[11px] text-[var(--muted)]">
                Acertos consolidam retenção e erros priorizam revisões no grafo.
              </p>
            </div>
          </div>

          {/* Seleção do Modo de Resposta */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-[var(--muted)] font-bold">Preferência:</span>
            <div className="inline-flex rounded-full border border-[var(--border)] p-0.5 bg-[oklch(0.96_0.01_84)]">
              <button
                onClick={() => setAnswerMode('misto')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  answerMode === 'misto' ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs' : 'text-[var(--muted)]'
                }`}
              >
                🎙️ + ⌨️ Misto
              </button>
              <button
                onClick={() => setAnswerMode('audio')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  answerMode === 'audio' ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs' : 'text-[var(--muted)]'
                }`}
              >
                🎙️ Somente Voz
              </button>
              <button
                onClick={() => setAnswerMode('texto')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
                  answerMode === 'texto' ? 'bg-[var(--surface)] text-[var(--fg)] shadow-xs' : 'text-[var(--muted)]'
                }`}
              >
                ⌨️ Somente Texto
              </button>
            </div>
          </div>

          {availableRoundCount === 0 ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-[var(--muted)]">
                Seu grafo ainda não tem termos em {activeTheme.nome} para montar um duelo.
              </p>
              {onPracticeInChat && (
                <Button onClick={() => onPracticeInChat(currentTopic)} className="rounded-full font-bold">
                  Criar termos conversando
                </Button>
              )}
            </div>
          ) : (
            <Button
              size="lg"
              variant="default"
              onClick={handleStartGame}
              className="w-full sm:w-auto px-8 py-3 text-sm font-bold tracking-wide rounded-full"
            >
              <Zap className="w-4 h-4 text-[var(--accent)]" />
              <span>
                INICIAR DUELO ({availableRoundCount} RODADA{availableRoundCount === 1 ? '' : 'S'})
              </span>
            </Button>
          )}
        </div>
      )}

      {/* TELA 2: RODADA ATIVA DE JOGO */}
      {gameState === 'playing' && currentQuestion && (
        <div className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full space-y-4">
          {/* Barra do Cronômetro com Pulso */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center space-x-1.5">
                <Timer className={`w-4 h-4 ${timeLeft <= 4 ? 'text-rose-600 animate-spin' : 'text-[var(--ok)]'}`} />
                <span className={`font-mono font-bold ${timeLeft <= 4 ? 'text-rose-600' : 'text-[var(--fg)]'}`}>
                  {timeLeft}s restantes
                </span>
              </div>
              <span className="text-[var(--muted)]">
                Tipo: <strong className="text-[var(--fg)] uppercase font-mono">{currentQuestion.tipo.replace('_', ' ')}</strong>
              </span>
            </div>
            <div className="w-full h-2 bg-[oklch(0.94_0.01_84)] rounded-full overflow-hidden border border-[var(--border)]">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  timeLeft <= 4 ? 'bg-rose-500' : timeLeft <= 7 ? 'bg-[var(--sunny)]' : 'bg-[var(--ok)]'
                }`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>

          {/* Card Principal da Pergunta */}
          <div className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-6 sm:p-7 shadow-xs space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs border border-[var(--border)] bg-[oklch(0.96_0.01_84)] text-[var(--fg)] font-bold font-mono">
              <span>{activeTheme.bandeira}</span>
              <span>{currentQuestion.idioma_origem} ➔ {currentQuestion.idioma_alvo}</span>
            </div>

            {/* Termo em Destaque com Pronúncia e Áudio */}
            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight text-[var(--fg)]">
                  {currentQuestion.termo_principal}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    SpeechService.speak(currentQuestion.termo_principal, {
                      lang: activeTheme.codigo_voz,
                      rate: 0.9,
                    })
                  }
                  className="p-1.5 rounded-full hover:bg-[oklch(0.96_0.01_84)] text-[var(--muted)] hover:text-[var(--fg)] transition cursor-pointer"
                  title="Ouvir pronúncia nativa"
                >
                  <Volume2 className="w-5 h-5 text-[var(--fg)]" />
                </button>
              </div>

              {currentQuestion.pronuncia_ipa && (
                <p className="text-xs font-mono text-[var(--muted)]">
                  IPA: {currentQuestion.pronuncia_ipa}
                </p>
              )}
            </div>

            {/* Dica ou Alerta de Falso Cognato */}
            {currentQuestion.dica_contextual && (
              <div className="inline-block p-3 rounded-2xl bg-[var(--mint)] border border-[var(--ok)]/30 text-xs text-[var(--fg)] font-medium max-w-lg">
                💡 {currentQuestion.dica_contextual}
              </div>
            )}
          </div>

          {/* Opções de Resposta: Múltipla Escolha Rápida */}
          {currentQuestion.opcoes_multipla_escolha && currentQuestion.opcoes_multipla_escolha.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {currentQuestion.opcoes_multipla_escolha.map((opt, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedOption(opt);
                    handleSubmitAnswer(opt, false);
                  }}
                  className={`p-3.5 rounded-2xl border text-left font-medium text-xs sm:text-sm transition cursor-pointer flex items-center justify-between hover:scale-[1.01] ${
                    selectedOption === opt
                      ? 'bg-[var(--fg)] text-[var(--accent)] border-[var(--fg)] font-bold shadow-md'
                      : 'bg-[var(--surface)] border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)]'
                  }`}
                >
                  <span className="font-bold">{opt}</span>
                  <span className="text-[10px] font-mono opacity-60">[{idx + 1}]</span>
                </button>
              ))}
            </div>
          ) : null}

          {/* Campo de Entrada por Texto e Áudio */}
          <div className="space-y-2 pt-2">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (inputAnswer.trim()) {
                  handleSubmitAnswer(inputAnswer.trim(), false);
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                autoFocus
                value={inputAnswer}
                onChange={(e) => setInputAnswer(e.target.value)}
                placeholder="Digite a tradução ou explicação rápida..."
                className="flex-1 px-4 py-3 text-xs sm:text-sm bg-[var(--surface)] border border-[var(--border)] rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--fg)] text-[var(--fg)]"
              />

              {/* Botão de Gravação de Áudio */}
              {answerMode !== 'texto' && (
                <button
                  type="button"
                  onClick={isRecording ? handleStopVoiceRecord : handleStartVoiceRecord}
                  disabled={audioTranscribing}
                  className={`px-4 py-3 rounded-full border text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                      : audioTranscribing
                      ? 'bg-[oklch(0.96_0.01_84)] text-[var(--muted)] border-[var(--border)]'
                      : 'bg-[var(--surface)] hover:bg-[oklch(0.96_0.01_84)] border-[var(--border)] text-[var(--fg)]'
                  }`}
                  title={isRecording ? 'Clique para parar e enviar áudio' : 'Falar resposta ao microfone (+30 pts)'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[var(--accent-deep)]" />}
                  <span className="hidden sm:inline">
                    {isRecording ? 'Gravando...' : audioTranscribing ? 'Transcrevendo...' : 'Falar'}
                  </span>
                </button>
              )}

              <Button type="submit" size="default" variant="default" className="px-5 py-3 cursor-pointer rounded-full font-bold">
                Responder
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* TELA 3: FEEDBACK DA RODADA */}
      {gameState === 'round_feedback' && lastAnswer && currentQuestion && (
        <div className="flex-1 flex flex-col justify-center max-w-xl mx-auto w-full space-y-5 text-center">
          <div
            className={`p-6 rounded-[var(--r-lg)] border ${
              lastAnswer.correta
                ? 'bg-[var(--mint)] border-[var(--ok)]/30 text-[var(--fg)]'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            } space-y-3`}
          >
            <div className="flex items-center justify-center space-x-2">
              {lastAnswer.correta ? (
                <CheckCircle2 className="w-8 h-8 text-[var(--ok)]" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-500" />
              )}
              <h3 className="text-xl font-display font-extrabold tracking-tight">
                {lastAnswer.correta ? 'RESPOSTA CORRETA!' : 'QUASE LÁ!'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm font-medium leading-relaxed">{lastAnswer.feedback}</p>

            {/* Pontuação Obtida */}
            {lastAnswer.correta && (
              <div className="flex items-center justify-center gap-3 pt-2 text-xs">
                <span className="px-3 py-1 bg-[var(--ok)] text-white rounded-full font-bold font-mono">
                  +{lastAnswer.pontos_ganhos} pts
                </span>
                {lastAnswer.bonus_velocidade > 0 && (
                  <span className="text-[var(--ok)] font-bold font-mono">
                    ⚡ +{lastAnswer.bonus_velocidade} vel.
                  </span>
                )}
                {lastAnswer.is_audio && (
                  <span className="text-[var(--fg)] font-bold font-mono">
                    🎙️ +30 voz
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Detalhes do Termo e Exemplo de Uso */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] p-5 text-left text-xs space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
              <span className="text-[var(--muted)]">Termo: <strong className="text-[var(--fg)] font-bold">{currentQuestion.termo_principal}</strong></span>
              <button
                type="button"
                onClick={() =>
                  SpeechService.speak(currentQuestion.termo_principal, {
                    lang: activeTheme.codigo_voz,
                    rate: 0.9,
                  })
                }
                className="p-1 text-[var(--muted)] hover:text-[var(--fg)] cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[var(--fg)]" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[var(--muted)] block font-bold">Significado / Resposta:</span>
              <p className="text-[var(--fg)] font-bold text-sm">{currentQuestion.resposta_esperada}</p>
            </div>

            {currentQuestion.exemplo_frase && (
              <div className="pt-2 border-t border-[var(--border)] space-y-1">
                <span className="text-[var(--muted)] block text-[11px] font-bold">Exemplo no contexto:</span>
                <p className="text-[var(--fg)] italic">"{currentQuestion.exemplo_frase}"</p>
              </div>
            )}
          </div>

          <Button
            size="lg"
            variant="default"
            onClick={handleNextQuestion}
            className="w-full py-3 font-bold cursor-pointer gap-2 rounded-full"
          >
            <span>{currentIndex + 1 < questions.length ? 'PRÓXIMA RODADA' : 'VER RESULTADO FINAL'}</span>
            <ArrowRight className="w-4 h-4 text-white" />
          </Button>
        </div>
      )}

      {/* TELA 4: RESUMO FINAL (GAME OVER) */}
      {gameState === 'game_over' && finalSession && (
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-[var(--accent)] text-[var(--fg)] flex items-center justify-center mx-auto shadow-xs border border-[var(--border)]">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-display font-extrabold tracking-tight text-[var(--fg)]">
              Duelo Concluído com Sucesso!
            </h3>
            <p className="text-xs sm:text-sm text-[var(--muted)]">
              Os dados de retenção foram atualizados dinamicamente no seu Grafo de Vocabulário.
            </p>
          </div>

          {/* Grid de Estatísticas Finais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">PONTUAÇÃO TOTAL</span>
              <span className="text-2xl font-display font-extrabold text-[var(--fg)] font-mono">{finalSession.pontuacao_total}</span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">PRECISÃO</span>
              <span className="text-2xl font-display font-extrabold text-[var(--ok)] font-mono">
                {Math.round((finalSession.acertos / Math.max(1, finalSession.questoes_totais)) * 100)}%
              </span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">MAIOR COMBO</span>
              <span className="text-2xl font-display font-extrabold text-[var(--fg)] font-mono">{finalSession.maior_combo}x 🔥</span>
            </div>

            <div className="p-4 rounded-[var(--r-md)] border border-[var(--border)] bg-[var(--surface)] shadow-xs">
              <span className="text-[var(--muted)] block text-[10px] font-extrabold uppercase">XP CONQUISTADO</span>
              <span className="text-2xl font-display font-extrabold text-[var(--ok)] font-mono">+{xpAwarded} XP</span>
            </div>
          </div>

          {/* Lista de Termos da Sessão */}
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-md)] p-5 text-left text-xs space-y-2 max-h-60 overflow-y-auto shadow-xs">
            <span className="text-[var(--muted)] font-extrabold uppercase text-[10px] block">
              Desempenho por Termo do Grafo:
            </span>
            <div className="space-y-1.5">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[oklch(0.96_0.01_84)] border border-[var(--border)]"
                  >
                    <div className="flex items-center space-x-2">
                      {ans?.correta ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ok)] shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span className="font-bold text-[var(--fg)]">{q.termo_principal}</span>
                    </div>
                    <span className="text-[var(--muted)] text-[11px] truncate max-w-[200px] font-medium">
                      {q.resposta_esperada}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Button
              size="lg"
              variant="default"
              onClick={handleStartGame}
              className="font-bold text-xs cursor-pointer gap-1.5 rounded-full"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>JOGAR NOVAMENTE</span>
            </Button>

            {onPracticeInChat && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPracticeInChat(currentTopic)}
                className="font-bold text-xs cursor-pointer gap-1.5 border-[var(--border)] rounded-full"
              >
                <Headphones className="w-4 h-4 text-[var(--fg)]" />
                <span>Praticar com o Tutor</span>
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
      )}
    </div>
  );
};
