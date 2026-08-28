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
import confetti from 'canvas-confetti';
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
    const generated = VocabDuelEngine.generateDuelQuestions(stats.idioma_ativo || currentTopic, 8);
    setQuestions(generated);
    setCurrentIndex(0);
    setAnswers([]);
    setInputAnswer('');
    setSelectedOption(null);
    setScore(0);
    setCurrentCombo(0);
    setFinalSession(null);
    setGameState('playing');
    startQuestionTimer(generated[0]?.tempo_limite_segundos || 12);
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
      setCurrentCombo((prev) => prev + 1);
      setScore((prev) => prev + roundAnswer.pontos_ganhos);
      // Efeito de som positivo ou TTS do exemplo
      const currentQ = questions[currentIndex];
      if (currentQ?.exemplo_frase) {
        SpeechService.speak(currentQ.exemplo_frase, { lang: activeTheme.codigo_voz, rate: 1.0 });
      }
    } else {
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
      const langCode = activeTheme.codigo_voz || 'en-US';
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
    <div className="flex flex-col h-full space-y-4">
      {/* Cabeçalho do Duelo */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-border">
        <div className="flex items-center space-x-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-white shadow-md ${
              activeTheme.button_class.split(' ')[0]
            }`}
          >
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                Duelo de Vocabulário
              </h2>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${activeTheme.badge_class}`}>
                {activeTheme.bandeira} {activeTheme.nome}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Desafios rápidos baseados no seu Grafo de Memória • Treine velocidade e precisão fonética
            </p>
          </div>
        </div>

        {/* Informações de Pontuação e Combo no Topo */}
        {gameState !== 'lobby' && (
          <div className="flex items-center space-x-3 text-xs font-mono">
            {/* Pontos */}
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-lg border border-border bg-card">
              <Trophy className="w-4 h-4 text-amber-500" />
              <span className="font-bold text-foreground">{score} pts</span>
            </div>

            {/* Multiplicador de Combo */}
            <div
              className={`flex items-center space-x-1 px-3 py-1 rounded-lg border font-bold transition-all ${
                currentCombo > 1
                  ? 'border-amber-500 bg-amber-500/10 text-amber-600 animate-pulse'
                  : 'border-border bg-card text-muted-foreground'
              }`}
            >
              <Flame className={`w-4 h-4 ${currentCombo > 1 ? 'text-amber-500 fill-amber-500' : ''}`} />
              <span>{currentCombo}x Combo</span>
            </div>

            {/* Progresso de Questões */}
            <div className="text-muted-foreground">
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
              className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto shadow-xl ${
                activeTheme.button_class.split(' ')[0]
              } text-white`}
            >
              <Zap className="w-10 h-10 animate-bounce" />
            </div>
            <span className="absolute -top-2 -right-2 text-2xl">{activeTheme.bandeira}</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Preparado para o Duelo de Velocidade?
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              O sistema extraiu termos com menor domínio, falsos cognatos e expressões do seu{' '}
              <span className="font-bold text-foreground">Grafo de Memória ({activeTheme.nome})</span>.
              Responda por áudio ou texto antes do tempo esgotar para acumular combos e XP!
            </p>
          </div>

          {/* Cards de Benefícios / Regras Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left font-mono text-xs">
            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <Timer className="w-3.5 h-3.5 text-amber-500" />
                <span>12s por Rodada</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bônus de velocidade para quem responder nos primeiros segundos.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <Mic className="w-3.5 h-3.5 text-blue-500" />
                <span>Bônus de Voz</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Responder em áudio confere +30 pontos e avalia sua pronúncia.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-border bg-card/60 space-y-1">
              <div className="flex items-center space-x-1.5 font-bold text-foreground">
                <Brain className="w-3.5 h-3.5 text-purple-500" />
                <span>Sincroniza Grafo</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Acertos consolidam retenção e erros priorizam revisões no grafo.
              </p>
            </div>
          </div>

          {/* Seleção do Modo de Resposta */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-muted-foreground">Preferência:</span>
            <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
              <button
                onClick={() => setAnswerMode('misto')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                  answerMode === 'misto' ? 'bg-background font-bold text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                🎙️ + ⌨️ Misto
              </button>
              <button
                onClick={() => setAnswerMode('audio')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                  answerMode === 'audio' ? 'bg-background font-bold text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                🎙️ Somente Voz
              </button>
              <button
                onClick={() => setAnswerMode('texto')}
                className={`px-3 py-1 rounded text-xs transition cursor-pointer ${
                  answerMode === 'texto' ? 'bg-background font-bold text-foreground shadow-2xs' : 'text-muted-foreground'
                }`}
              >
                ⌨️ Somente Texto
              </button>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleStartGame}
            className={`w-full sm:w-auto px-8 py-3 text-sm font-bold font-mono tracking-wide cursor-pointer gap-2 ${activeTheme.button_class}`}
          >
            <Zap className="w-4 h-4" />
            <span>INICIAR DUELO (8 RODADAS)</span>
          </Button>
        </div>
      )}

      {/* TELA 2: RODADA ATIVA DE JOGO */}
      {gameState === 'playing' && currentQuestion && (
        <div className="flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full space-y-4">
          {/* Barra do Cronômetro com Pulso */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <div className="flex items-center space-x-1.5">
                <Timer className={`w-4 h-4 ${timeLeft <= 4 ? 'text-red-500 animate-spin' : 'text-amber-500'}`} />
                <span className={`font-bold ${timeLeft <= 4 ? 'text-red-500' : 'text-foreground'}`}>
                  {timeLeft}s restantes
                </span>
              </div>
              <span className="text-muted-foreground">
                Tipo: <strong className="text-foreground uppercase">{currentQuestion.tipo.replace('_', ' ')}</strong>
              </span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden border border-border">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  timeLeft <= 4 ? 'bg-red-500' : timeLeft <= 7 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>

          {/* Card Principal da Pergunta */}
          <div className="relative bg-card border border-border/80 rounded-2xl p-6 sm:p-7 shadow-xs space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-border/80 bg-secondary text-muted-foreground font-medium">
              <span>{activeTheme.bandeira}</span>
              <span>{currentQuestion.idioma_origem} ➔ {currentQuestion.idioma_alvo}</span>
            </div>

            {/* Termo em Destaque com Pronúncia e Áudio */}
            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
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
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Ouvir pronúncia nativa"
                >
                  <Volume2 className="w-5 h-5 text-foreground" />
                </button>

              </div>

              {currentQuestion.pronuncia_ipa && (
                <p className="text-xs font-mono text-muted-foreground">
                  IPA: {currentQuestion.pronuncia_ipa}
                </p>
              )}
            </div>

            {/* Dica ou Alerta de Falso Cognato */}
            {currentQuestion.dica_contextual && (
              <div className="inline-block p-2 rounded-lg bg-muted/50 border border-border/80 text-xs text-muted-foreground font-mono max-w-lg">
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
                  className={`p-3.5 rounded-xl border text-left font-medium text-xs sm:text-sm transition cursor-pointer flex items-center justify-between hover:scale-[1.01] ${
                    selectedOption === opt
                      ? 'bg-foreground text-background border-foreground font-bold shadow-md'
                      : 'bg-card border-border text-foreground hover:bg-muted hover:border-foreground/40'
                  }`}
                >
                  <span>{opt}</span>
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
                className="flex-1 px-4 py-3 text-xs sm:text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring text-foreground font-mono"
              />

              {/* Botão de Gravação de Áudio */}
              {answerMode !== 'texto' && (
                <button
                  type="button"
                  onClick={isRecording ? handleStopVoiceRecord : handleStartVoiceRecord}
                  disabled={audioTranscribing}
                  className={`px-4 py-3 rounded-xl border font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isRecording
                      ? 'bg-red-600 text-white border-red-600 animate-pulse'
                      : audioTranscribing
                      ? 'bg-muted text-muted-foreground border-border'
                      : 'bg-card hover:bg-muted border-border text-foreground'
                  }`}
                  title={isRecording ? 'Clique para parar e enviar áudio' : 'Falar resposta ao microfone (+30 pts)'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  <span className="hidden sm:inline">
                    {isRecording ? 'Gravando...' : audioTranscribing ? 'Transcrevendo...' : 'Falar'}
                  </span>
                </button>
              )}

              <Button type="submit" size="default" className={`px-5 py-3 cursor-pointer ${activeTheme.button_class}`}>
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
            className={`p-6 rounded-2xl border ${
              lastAnswer.correta
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
            } space-y-3`}
          >
            <div className="flex items-center justify-center space-x-2">
              {lastAnswer.correta ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              ) : (
                <XCircle className="w-8 h-8 text-red-500" />
              )}
              <h3 className="text-xl font-bold tracking-tight">
                {lastAnswer.correta ? 'RESPOSTA CORRETA!' : 'QUASE LÁ!'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm font-medium">{lastAnswer.feedback}</p>

            {/* Pontuação Obtida */}
            {lastAnswer.correta && (
              <div className="flex items-center justify-center gap-3 pt-2 font-mono text-xs">
                <span className="px-2 py-1 bg-emerald-500/20 rounded font-bold">
                  +{lastAnswer.pontos_ganhos} pts
                </span>
                {lastAnswer.bonus_velocidade > 0 && (
                  <span className="text-amber-600 font-bold">
                    ⚡ +{lastAnswer.bonus_velocidade} vel.
                  </span>
                )}
                {lastAnswer.is_audio && (
                  <span className="text-blue-600 font-bold">
                    🎙️ +30 voz
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Detalhes do Termo e Exemplo de Uso */}
          <div className="bg-card border border-border rounded-xl p-4 text-left font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="text-muted-foreground">Termo: <strong className="text-foreground">{currentQuestion.termo_principal}</strong></span>
              <button
                type="button"
                onClick={() =>
                  SpeechService.speak(currentQuestion.termo_principal, {
                    lang: activeTheme.codigo_voz,
                    rate: 0.9,
                  })
                }
                className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <Volume2 className="w-4 h-4" />
              </button>

            </div>

            <div className="space-y-1">
              <span className="text-muted-foreground block">Significado / Resposta:</span>
              <p className="text-foreground font-bold">{currentQuestion.resposta_esperada}</p>
            </div>

            {currentQuestion.exemplo_frase && (
              <div className="pt-2 border-t border-border space-y-1">
                <span className="text-muted-foreground block text-[11px]">Exemplo no contexto:</span>
                <p className="text-foreground italic">"{currentQuestion.exemplo_frase}"</p>
              </div>
            )}
          </div>

          <Button
            size="lg"
            onClick={handleNextQuestion}
            className={`w-full py-3 font-mono font-bold cursor-pointer gap-2 ${activeTheme.button_class}`}
          >
            <span>{currentIndex + 1 < questions.length ? 'PRÓXIMA RODADA' : 'VER RESULTADO FINAL'}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* TELA 4: RESUMO FINAL (GAME OVER) */}
      {gameState === 'game_over' && finalSession && (
        <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full space-y-6 text-center">
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-2xl bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight text-foreground">
              Duelo Concluído com Sucesso!
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground font-mono">
              Os dados de retenção foram atualizados dinamicamente no seu Grafo de Vocabulário.
            </p>
          </div>

          {/* Grid de Estatísticas Finais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">PONTUAÇÃO TOTAL</span>
              <span className="text-lg font-bold text-foreground">{finalSession.pontuacao_total}</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">PRECISÃO</span>
              <span className="text-lg font-bold text-emerald-500">
                {Math.round((finalSession.acertos / Math.max(1, finalSession.questoes_totais)) * 100)}%
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">MAIOR COMBO</span>
              <span className="text-lg font-bold text-amber-500">{finalSession.maior_combo}x 🔥</span>
            </div>

            <div className="p-3.5 rounded-xl border border-border bg-card">
              <span className="text-muted-foreground block text-[10px]">XP CONQUISTADO</span>
              <span className="text-lg font-bold text-blue-500">+{xpAwarded} XP</span>
            </div>
          </div>

          {/* Lista de Termos da Sessão */}
          <div className="bg-card border border-border rounded-xl p-4 text-left font-mono text-xs space-y-2 max-h-60 overflow-y-auto">
            <span className="text-muted-foreground font-bold uppercase text-[10px] block">
              Desempenho por Termo do Grafo:
            </span>
            <div className="space-y-1.5">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border"
                  >
                    <div className="flex items-center space-x-2">
                      {ans?.correta ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="font-bold text-foreground">{q.termo_principal}</span>
                    </div>
                    <span className="text-muted-foreground text-[11px] truncate max-w-[200px]">
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
              onClick={handleStartGame}
              className={`font-mono text-xs font-bold cursor-pointer gap-1.5 ${activeTheme.button_class}`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>JOGAR NOVAMENTE</span>
            </Button>

            {onPracticeInChat && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPracticeInChat(currentTopic)}
                className="font-mono text-xs cursor-pointer gap-1.5 border-border"
              >
                <Headphones className="w-4 h-4" />
                <span>Praticar com o Tutor</span>
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
      )}
    </div>
  );
};
