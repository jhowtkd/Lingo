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
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-[#171719]/10">
        <div className="flex items-center space-x-3">
          <div
            className="w-10 h-10 rounded-[9px] bg-[#171719] text-[#1ff98c] flex items-center justify-center font-bold shadow-xs border border-[#171719]/20"
          >
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-[#171719]">
                Duelo de Vocabulário
              </h2>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full border border-[#171719]/15 bg-[#ededed] uppercase font-bold text-[#171719]">
                {activeTheme.bandeira} {activeTheme.nome}
              </span>
            </div>
            <p className="text-xs text-[#71717a] font-mono">
              Desafios rápidos baseados no seu Grafo de Memória • Treine velocidade e precisão fonética
            </p>
          </div>
        </div>

        {/* Informações de Pontuação e Combo no Topo */}
        {gameState !== 'lobby' && (
          <div className="flex items-center space-x-3 text-xs font-mono">
            {/* Pontos */}
            <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-[9px] border border-[#171719]/15 bg-white shadow-xs">
              <Trophy className="w-4 h-4 text-[#08ba61]" />
              <span className="font-bold text-[#171719]">{score} pts</span>
            </div>

            {/* Multiplicador de Combo */}
            <div
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-[9px] border font-bold transition-all ${
                currentCombo > 1
                  ? 'border-[#08ba61] bg-[#1ff98c]/20 text-[#08ba61]'
                  : 'border-[#171719]/15 bg-white text-[#71717a]'
              }`}
            >
              <Flame className={`w-4 h-4 ${currentCombo > 1 ? 'text-[#08ba61] fill-[#08ba61]' : ''}`} />
              <span>{currentCombo}x Combo</span>
            </div>

            {/* Progresso de Questões */}
            <div className="text-[#71717a] font-bold">
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
              className="w-20 h-20 rounded-[20px] bg-[#171719] text-[#1ff98c] flex items-center justify-center mx-auto shadow-md border border-[#171719]/20"
            >
              <Zap className="w-10 h-10" />
            </div>
            <span className="absolute -top-2 -right-2 text-2xl">{activeTheme.bandeira}</span>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#171719]">
              Preparado para o Duelo de Velocidade?
            </h3>
            <p className="text-xs sm:text-sm text-[#71717a] max-w-md mx-auto leading-relaxed">
              O sistema extraiu termos com menor domínio, falsos cognatos e expressões do seu{' '}
              <span className="font-bold text-[#171719]">Grafo de Memória ({activeTheme.nome})</span>.
              Responda por áudio ou texto antes do tempo esgotar para acumular combos e XP!
            </p>
          </div>

          {/* Cards de Benefícios / Regras Rápidas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full text-left font-mono text-xs">
            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[#171719]">
                <Timer className="w-3.5 h-3.5 text-[#08ba61]" />
                <span>12s por Rodada</span>
              </div>
              <p className="text-[11px] text-[#71717a]">
                Bônus de velocidade para quem responder nos primeiros segundos.
              </p>
            </div>

            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[#171719]">
                <Mic className="w-3.5 h-3.5 text-[#08ba61]" />
                <span>Bônus de Voz</span>
              </div>
              <p className="text-[11px] text-[#71717a]">
                Responder em áudio confere +30 pontos e avalia sua pronúncia.
              </p>
            </div>

            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white space-y-1 shadow-xs">
              <div className="flex items-center space-x-1.5 font-bold text-[#171719]">
                <Brain className="w-3.5 h-3.5 text-[#171719]" />
                <span>Sincroniza Grafo</span>
              </div>
              <p className="text-[11px] text-[#71717a]">
                Acertos consolidam retenção e erros priorizam revisões no grafo.
              </p>
            </div>
          </div>

          {/* Seleção do Modo de Resposta */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-[#71717a] font-bold">Preferência:</span>
            <div className="inline-flex rounded-[9px] border border-[#171719]/15 p-0.5 bg-[#ededed]">
              <button
                onClick={() => setAnswerMode('misto')}
                className={`px-3 py-1.5 rounded-[7px] text-xs font-bold transition cursor-pointer ${
                  answerMode === 'misto' ? 'bg-white text-[#171719] shadow-xs' : 'text-[#71717a]'
                }`}
              >
                🎙️ + ⌨️ Misto
              </button>
              <button
                onClick={() => setAnswerMode('audio')}
                className={`px-3 py-1.5 rounded-[7px] text-xs font-bold transition cursor-pointer ${
                  answerMode === 'audio' ? 'bg-white text-[#171719] shadow-xs' : 'text-[#71717a]'
                }`}
              >
                🎙️ Somente Voz
              </button>
              <button
                onClick={() => setAnswerMode('texto')}
                className={`px-3 py-1.5 rounded-[7px] text-xs font-bold transition cursor-pointer ${
                  answerMode === 'texto' ? 'bg-white text-[#171719] shadow-xs' : 'text-[#71717a]'
                }`}
              >
                ⌨️ Somente Texto
              </button>
            </div>
          </div>

          <Button
            size="lg"
            variant="default"
            onClick={handleStartGame}
            className="w-full sm:w-auto px-8 py-3 text-sm font-bold tracking-wide cursor-pointer gap-2 rounded-[9px]"
          >
            <Zap className="w-4 h-4 text-[#1ff98c]" />
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
                <Timer className={`w-4 h-4 ${timeLeft <= 4 ? 'text-rose-600 animate-spin' : 'text-[#08ba61]'}`} />
                <span className={`font-bold ${timeLeft <= 4 ? 'text-rose-600' : 'text-[#171719]'}`}>
                  {timeLeft}s restantes
                </span>
              </div>
              <span className="text-[#71717a]">
                Tipo: <strong className="text-[#171719] uppercase">{currentQuestion.tipo.replace('_', ' ')}</strong>
              </span>
            </div>
            <div className="w-full h-2 bg-[#ededed] rounded-full overflow-hidden border border-[#171719]/10">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  timeLeft <= 4 ? 'bg-rose-500' : timeLeft <= 7 ? 'bg-amber-500' : 'bg-[#08ba61]'
                }`}
                style={{ width: `${timePercent}%` }}
              />
            </div>
          </div>

          {/* Card Principal da Pergunta */}
          <div className="relative bg-white border border-[#171719]/10 rounded-[25px] p-6 sm:p-7 shadow-xs space-y-4 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border border-[#171719]/15 bg-[#ededed] text-[#171719] font-bold">
              <span>{activeTheme.bandeira}</span>
              <span>{currentQuestion.idioma_origem} ➔ {currentQuestion.idioma_alvo}</span>
            </div>

            {/* Termo em Destaque com Pronúncia e Áudio */}
            <div className="space-y-1">
              <div className="flex items-center justify-center space-x-2">
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#171719]">
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
                  className="p-1.5 rounded-full hover:bg-[#ededed] text-[#71717a] hover:text-[#171719] transition cursor-pointer"
                  title="Ouvir pronúncia nativa"
                >
                  <Volume2 className="w-5 h-5 text-[#171719]" />
                </button>
              </div>

              {currentQuestion.pronuncia_ipa && (
                <p className="text-xs font-mono text-[#71717a]">
                  IPA: {currentQuestion.pronuncia_ipa}
                </p>
              )}
            </div>

            {/* Dica ou Alerta de Falso Cognato */}
            {currentQuestion.dica_contextual && (
              <div className="inline-block p-2.5 rounded-[12px] bg-[#1ff98c]/15 border border-[#08ba61]/30 text-xs text-[#171719] font-medium max-w-lg">
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
                  className={`p-3.5 rounded-[16px] border text-left font-medium text-xs sm:text-sm transition cursor-pointer flex items-center justify-between hover:scale-[1.01] ${
                    selectedOption === opt
                      ? 'bg-[#171719] text-[#1ff98c] border-[#171719] font-bold shadow-md'
                      : 'bg-white border-[#171719]/15 text-[#171719] hover:bg-[#ededed] hover:border-[#171719]/40'
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
                className="flex-1 px-4 py-3 text-xs sm:text-sm bg-white border border-[#171719]/15 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-[#08ba61] text-[#171719] font-mono"
              />

              {/* Botão de Gravação de Áudio */}
              {answerMode !== 'texto' && (
                <button
                  type="button"
                  onClick={isRecording ? handleStopVoiceRecord : handleStartVoiceRecord}
                  disabled={audioTranscribing}
                  className={`px-4 py-3 rounded-[12px] border font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                    isRecording
                      ? 'bg-rose-600 text-white border-rose-600 animate-pulse'
                      : audioTranscribing
                      ? 'bg-[#ededed] text-[#71717a] border-[#171719]/15'
                      : 'bg-white hover:bg-[#ededed] border-[#171719]/15 text-[#171719]'
                  }`}
                  title={isRecording ? 'Clique para parar e enviar áudio' : 'Falar resposta ao microfone (+30 pts)'}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#08ba61]" />}
                  <span className="hidden sm:inline">
                    {isRecording ? 'Gravando...' : audioTranscribing ? 'Transcrevendo...' : 'Falar'}
                  </span>
                </button>
              )}

              <Button type="submit" size="default" variant="default" className="px-5 py-3 cursor-pointer rounded-[12px] font-bold">
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
            className={`p-6 rounded-[25px] border ${
              lastAnswer.correta
                ? 'bg-[#1ff98c]/15 border-[#08ba61]/30 text-[#171719]'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700'
            } space-y-3`}
          >
            <div className="flex items-center justify-center space-x-2">
              {lastAnswer.correta ? (
                <CheckCircle2 className="w-8 h-8 text-[#08ba61]" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-500" />
              )}
              <h3 className="text-xl font-extrabold tracking-tight">
                {lastAnswer.correta ? 'RESPOSTA CORRETA!' : 'QUASE LÁ!'}
              </h3>
            </div>

            <p className="text-xs sm:text-sm font-medium leading-relaxed">{lastAnswer.feedback}</p>

            {/* Pontuação Obtida */}
            {lastAnswer.correta && (
              <div className="flex items-center justify-center gap-3 pt-2 font-mono text-xs">
                <span className="px-2.5 py-1 bg-[#08ba61] text-white rounded-[6px] font-bold">
                  +{lastAnswer.pontos_ganhos} pts
                </span>
                {lastAnswer.bonus_velocidade > 0 && (
                  <span className="text-[#08ba61] font-bold">
                    ⚡ +{lastAnswer.bonus_velocidade} vel.
                  </span>
                )}
                {lastAnswer.is_audio && (
                  <span className="text-[#171719] font-bold">
                    🎙️ +30 voz
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Detalhes do Termo e Exemplo de Uso */}
          <div className="bg-white border border-[#171719]/10 rounded-[20px] p-5 text-left font-mono text-xs space-y-2.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-[#171719]/10 pb-2">
              <span className="text-[#71717a]">Termo: <strong className="text-[#171719] font-bold">{currentQuestion.termo_principal}</strong></span>
              <button
                type="button"
                onClick={() =>
                  SpeechService.speak(currentQuestion.termo_principal, {
                    lang: activeTheme.codigo_voz,
                    rate: 0.9,
                  })
                }
                className="p-1 text-[#71717a] hover:text-[#171719] cursor-pointer"
              >
                <Volume2 className="w-4 h-4 text-[#171719]" />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-[#71717a] block font-bold">Significado / Resposta:</span>
              <p className="text-[#171719] font-bold text-sm">{currentQuestion.resposta_esperada}</p>
            </div>

            {currentQuestion.exemplo_frase && (
              <div className="pt-2 border-t border-[#171719]/10 space-y-1">
                <span className="text-[#71717a] block text-[11px] font-bold">Exemplo no contexto:</span>
                <p className="text-[#171719] italic">"{currentQuestion.exemplo_frase}"</p>
              </div>
            )}
          </div>

          <Button
            size="lg"
            variant="default"
            onClick={handleNextQuestion}
            className="w-full py-3 font-bold cursor-pointer gap-2 rounded-[9px]"
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
            <div className="w-16 h-16 rounded-[14px] bg-[#1ff98c] text-[#171719] flex items-center justify-center mx-auto shadow-sm border border-[#171719]/20">
              <Award className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-extrabold tracking-tight text-[#171719]">
              Duelo Concluído com Sucesso!
            </h3>
            <p className="text-xs sm:text-sm text-[#71717a] font-mono">
              Os dados de retenção foram atualizados dinamicamente no seu Grafo de Vocabulário.
            </p>
          </div>

          {/* Grid de Estatísticas Finais */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs">
            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white shadow-xs">
              <span className="text-[#71717a] block text-[10px] font-bold">PONTUAÇÃO TOTAL</span>
              <span className="text-xl font-extrabold text-[#171719]">{finalSession.pontuacao_total}</span>
            </div>

            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white shadow-xs">
              <span className="text-[#71717a] block text-[10px] font-bold">PRECISÃO</span>
              <span className="text-xl font-extrabold text-[#08ba61]">
                {Math.round((finalSession.acertos / Math.max(1, finalSession.questoes_totais)) * 100)}%
              </span>
            </div>

            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white shadow-xs">
              <span className="text-[#71717a] block text-[10px] font-bold">MAIOR COMBO</span>
              <span className="text-xl font-extrabold text-[#171719]">{finalSession.maior_combo}x 🔥</span>
            </div>

            <div className="p-4 rounded-[20px] border border-[#171719]/10 bg-white shadow-xs">
              <span className="text-[#71717a] block text-[10px] font-bold">XP CONQUISTADO</span>
              <span className="text-xl font-extrabold text-[#08ba61]">+{xpAwarded} XP</span>
            </div>
          </div>

          {/* Lista de Termos da Sessão */}
          <div className="bg-white border border-[#171719]/10 rounded-[20px] p-5 text-left font-mono text-xs space-y-2 max-h-60 overflow-y-auto shadow-xs">
            <span className="text-[#71717a] font-bold uppercase text-[10px] block">
              Desempenho por Termo do Grafo:
            </span>
            <div className="space-y-1.5">
              {questions.map((q, idx) => {
                const ans = answers[idx];
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-[9px] bg-[#ededed] border border-[#171719]/10"
                  >
                    <div className="flex items-center space-x-2">
                      {ans?.correta ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#08ba61] shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span className="font-bold text-[#171719]">{q.termo_principal}</span>
                    </div>
                    <span className="text-[#71717a] text-[11px] truncate max-w-[200px] font-medium">
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
              className="font-bold text-xs cursor-pointer gap-1.5 rounded-[9px]"
            >
              <RotateCcw className="w-4 h-4 text-white" />
              <span>JOGAR NOVAMENTE</span>
            </Button>

            {onPracticeInChat && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => onPracticeInChat(currentTopic)}
                className="font-bold text-xs cursor-pointer gap-1.5 border-[#171719]/15 rounded-[9px]"
              >
                <Headphones className="w-4 h-4 text-[#171719]" />
                <span>Praticar com o Tutor</span>
              </Button>
            )}

            {onNavigateToGraph && (
              <Button
                variant="ghost"
                size="lg"
                onClick={onNavigateToGraph}
                className="font-bold text-xs cursor-pointer gap-1.5 text-[#71717a] hover:text-[#171719] rounded-[9px]"
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
