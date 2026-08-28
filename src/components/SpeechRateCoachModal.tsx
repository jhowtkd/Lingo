import React, { useState, useEffect, useRef } from 'react';
import {
  Gauge,
  X,
  Play,
  Square,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Award,
  Zap,
  BookOpen,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import { CEFRLevel, SpeechRateMetrics } from '../types';
import {
  SpeechRateService,
  CEFR_SPEECH_RATE_TARGETS,
} from '../services/speechRateService';
import { SpeechRateVisualizer } from './SpeechRateVisualizer';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

interface SpeechRateCoachModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentLevel: 'Iniciante' | 'Intermediário' | 'Avançado';
  allSpokenMetrics: SpeechRateMetrics[];
}

const SAMPLE_PRACTICE_PHRASES: Record<CEFRLevel, { text: string; translation: string; words: number }[]> = {
  A1: [
    {
      text: 'Hello, my name is Alex and I live in a quiet city.',
      translation: 'Olá, meu nome é Alex e eu moro em uma cidade tranquila.',
      words: 11,
    },
    {
      text: 'I like to drink coffee and read books in the morning.',
      translation: 'Eu gosto de tomar café e ler livros pela manhã.',
      words: 11,
    },
  ],
  A2: [
    {
      text: 'Yesterday, I went to the supermarket to buy fresh fruits and vegetables for dinner.',
      translation: 'Ontem, fui ao supermercado comprar frutas e vegetais frescos para o jantar.',
      words: 14,
    },
    {
      text: 'Can you tell me what time the train arrives at the station tomorrow?',
      translation: 'Você pode me dizer a que horas o trem chega na estação amanhã?',
      words: 13,
    },
  ],
  B1: [
    {
      text: 'Although it was raining heavily outside, we decided to continue our walking tour around the historical center.',
      translation: 'Embora estivesse chovendo forte lá fora, decidimos continuar nosso passeio a pé pelo centro histórico.',
      words: 17,
    },
    {
      text: 'Learning a second language requires regular practice and patience to build confident conversational skills.',
      translation: 'Aprender um segundo idioma exige prática regular e paciência para desenvolver habilidades de conversação confiantes.',
      words: 15,
    },
  ],
  B2: [
    {
      text: 'In recent years, remote collaboration tools have fundamentally transformed how multinational teams coordinate their projects across different time zones.',
      translation: 'Nos últimos anos, ferramentas de colaboração remota transformaram fundamentalmente como equipes multinacionais coordenam projetos.',
      words: 19,
    },
    {
      text: 'Effective communication is not merely about correct grammar, but about conveying subtle nuances with natural phrasing and appropriate cadence.',
      translation: 'Comunicação eficaz não é apenas sobre gramática correta, mas sobre transmitir nuances sutis com fraseamento natural.',
      words: 19,
    },
  ],
  C1: [
    {
      text: 'While the preliminary findings appear promising, rigorous empirical validation is indispensable before drawing definitive conclusions about the long-term efficacy of the methodology.',
      translation: 'Embora os achados preliminares pareçam promissores, uma validação empírica rigorosa é indispensável antes de conclusões definitivas.',
      words: 22,
    },
    {
      text: 'Navigating ambiguous negotiations requires a sophisticated grasp of pragmatic discourse, allowing one to de-escalate tension effortlessly.',
      translation: 'Conduzir negociações ambíguas requer um domínio sofisticado do discurso pragmático, permitindo desarmar tensões sem esforço.',
      words: 17,
    },
  ],
  C2: [
    {
      text: 'The speaker eloquently juxtaposed historical paradigms against contemporary socio-economic shifts, elucidating the multifaceted nuances with remarkable eloquence and spontaneity.',
      translation: 'O orador justapôs de forma eloquente paradigmas históricos a mudanças socioeconômicas contemporâneas.',
      words: 19,
    },
    {
      text: 'Mastery of an idiom implies an innate sensitivity to phonetic cadence, idiomatic subtleties, and effortless articulation under rapid dialogue constraints.',
      translation: 'O domínio de um idioma implica sensibilidade inata à cadência fonética, sutilezas idiomáticas e articulação espontânea.',
      words: 21,
    },
  ],
};

export const SpeechRateCoachModal: React.FC<SpeechRateCoachModalProps> = ({
  isOpen,
  onClose,
  studentLevel,
  allSpokenMetrics,
}) => {
  const initialCefr = SpeechRateService.mapStudentLevelToCEFR(studentLevel);
  const [selectedCefr, setSelectedCefr] = useState<CEFRLevel>(initialCefr);

  // Estados do Treinador de Leitura / Metrônomo
  const [activePhraseIndex, setActivePhraseIndex] = useState(0);
  const [isReadingActive, setIsReadingActive] = useState(false);
  const [readingStartTime, setReadingStartTime] = useState<number | null>(null);
  const [elapsedReadingSeconds, setElapsedReadingSeconds] = useState(0);
  const [readingTestResult, setReadingTestResult] = useState<SpeechRateMetrics | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    setSelectedCefr(SpeechRateService.mapStudentLevelToCEFR(studentLevel));
  }, [studentLevel]);

  useEffect(() => {
    if (isReadingActive) {
      timerRef.current = setInterval(() => {
        if (readingStartTime) {
          const secs = (Date.now() - readingStartTime) / 1000;
          setElapsedReadingSeconds(secs);
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isReadingActive, readingStartTime]);

  if (!isOpen) return null;

  const phrases = SAMPLE_PRACTICE_PHRASES[selectedCefr] || SAMPLE_PRACTICE_PHRASES['B1'];
  const currentPhrase = phrases[activePhraseIndex % phrases.length];

  // Métricas gerais da sessão
  const sessionAvgWpm =
    allSpokenMetrics.length > 0
      ? Math.round(
          allSpokenMetrics.reduce((sum, m) => sum + m.wpm, 0) / allSpokenMetrics.length
        )
      : null;

  const target = CEFR_SPEECH_RATE_TARGETS[selectedCefr];

  const handleStartReadingTest = () => {
    setReadingTestResult(null);
    setElapsedReadingSeconds(0);
    setReadingStartTime(Date.now());
    setIsReadingActive(true);
  };

  const handleFinishReadingTest = () => {
    if (!readingStartTime) return;
    const totalSecs = Math.max(1, (Date.now() - readingStartTime) / 1000);
    setIsReadingActive(false);
    setReadingStartTime(null);

    const calculated = SpeechRateService.calculateSpeechRate(
      currentPhrase.text,
      totalSecs,
      selectedCefr
    );
    setReadingTestResult(calculated);

    if (calculated.pacing === 'ideal') {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 },
      });
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col font-sans"
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-foreground text-background flex items-center justify-center font-mono">
                <Gauge className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                    Treinador de Taxa de Fala & Ritmo
                  </h2>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    WPM / PPM
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Calibração da velocidade de fala (Palavras por Minuto) por nível de proficiência CEFR
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Conteúdo com Scroll */}
          <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
            {/* Card de Resumo da Sessão Atual */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono font-bold block">
                  Média na Conversa Atual
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black font-mono text-foreground">
                    {sessionAvgWpm ? `${sessionAvgWpm}` : '--'}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">PPM</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {allSpokenMetrics.length > 0
                    ? `Baseado em ${allSpokenMetrics.length} mensagem(ns) falada(s).`
                    : 'Grave áudios no chat para calcular a média.'}
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono font-bold block">
                  Faixa Alvo ({selectedCefr})
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-black font-mono text-foreground">
                    {target.minWpm} - {target.maxWpm}
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">PPM</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Cadência natural esperada para {target.nome}.
                </p>
              </div>

              <div className="p-3 bg-muted/40 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono font-bold block">
                  Nível Atual do Aluno
                </span>
                <div className="flex items-center space-x-1.5">
                  <Badge variant="default" className="font-mono text-xs font-bold">
                    {studentLevel} ({selectedCefr})
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Foco: {target.nome}.
                </p>
              </div>
            </div>

            {/* Seletor de Nível CEFR e Guia de Referência */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-mono font-bold uppercase text-foreground flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Referência de Velocidade CEFR (A1 a C2)</span>
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Selecione para calibrar o alvo
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CEFRLevel[]).map((level) => {
                  const isSelected = selectedCefr === level;
                  const t = CEFR_SPEECH_RATE_TARGETS[level];
                  return (
                    <button
                      key={level}
                      onClick={() => {
                        setSelectedCefr(level);
                        setReadingTestResult(null);
                      }}
                      className={`p-2 rounded-lg border text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-foreground bg-foreground text-background font-bold shadow-xs'
                          : 'border-border bg-card text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{level}</span>
                        <span
                          className={`text-[9px] font-mono ${
                            isSelected ? 'text-background/80' : 'text-muted-foreground'
                          }`}
                        >
                          {t.minWpm}-{t.maxWpm}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] truncate mt-1 ${
                          isSelected ? 'text-background/90' : 'text-muted-foreground'
                        }`}
                      >
                        {t.nome}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Detalhes do Nível Selecionado */}
              <div className="p-3.5 bg-muted/30 border border-border rounded-lg space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between text-foreground">
                  <span className="font-bold">
                    Diretriz Pedagógica para Nível {selectedCefr} ({target.nome}):
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Faixa Ideal: {target.minWpm} a {target.maxWpm} PPM (Ideal: ~{target.idealWpm} PPM)
                  </span>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed font-sans">
                  {target.descricao} — {target.ritmoEsperado}
                </p>
              </div>
            </div>

            {/* Laboratório Interativo de Leitura & Ritmo Vocal */}
            <div className="p-4 bg-muted/20 border border-border rounded-xl space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-mono font-bold uppercase text-foreground">
                    Laboratório de Leitura & Calibração de Ritmo
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setActivePhraseIndex((prev) => prev + 1);
                    setReadingTestResult(null);
                  }}
                  className="font-mono text-xs cursor-pointer gap-1 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Outra Frase de Teste</span>
                </Button>
              </div>

              <div className="p-4 bg-card border border-border rounded-lg space-y-2">
                <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                  <span>FRASE DE TREINO ({currentPhrase.words} PALAVRAS)</span>
                  <span>NÍVEL {selectedCefr}</span>
                </div>
                <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
                  "{currentPhrase.text}"
                </p>
                <p className="text-xs text-muted-foreground italic">
                  {currentPhrase.translation}
                </p>
              </div>

              {/* Controles de Teste com Cronômetro */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  {!isReadingActive ? (
                    <Button
                      onClick={handleStartReadingTest}
                      className="font-mono text-xs cursor-pointer gap-1.5 bg-foreground text-background hover:bg-foreground/90"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Iniciar Leitura em Voz Alta</span>
                    </Button>
                  ) : (
                    <Button
                      onClick={handleFinishReadingTest}
                      variant="destructive"
                      className="font-mono text-xs cursor-pointer gap-1.5 animate-pulse"
                    >
                      <Square className="w-3.5 h-3.5" />
                      <span>Concluir Leitura (Parar)</span>
                    </Button>
                  )}

                  {isReadingActive && (
                    <div className="flex items-center space-x-2 font-mono text-xs">
                      <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                      <span className="font-bold text-foreground">
                        {elapsedReadingSeconds.toFixed(1)}s
                      </span>
                    </div>
                  )}
                </div>

                <div className="text-[11px] font-mono text-muted-foreground text-right">
                  Dica: Leia no seu ritmo natural de fala, sem correr.
                </div>
              </div>

              {/* Resultado do Teste de Leitura */}
              {readingTestResult && (
                <div className="pt-2 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-foreground uppercase">
                      Resultado da Sua Leitura
                    </span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {readingTestResult.durationSeconds}s de áudio
                    </Badge>
                  </div>
                  <SpeechRateVisualizer
                    metrics={readingTestResult}
                    variant="full"
                    allowLevelChange={false}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Rodapé */}
          <div className="p-3 sm:p-4 border-t border-border bg-muted/20 flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground text-[11px]">
              Alvo pedagógico calibrado com o padrão europeu CEFR.
            </span>
            <Button
              size="sm"
              onClick={onClose}
              className="font-mono text-xs cursor-pointer bg-foreground text-background hover:bg-foreground/90"
            >
              Fechar Treinador
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
