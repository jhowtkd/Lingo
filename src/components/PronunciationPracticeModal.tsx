import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Volume2,
  Sparkles,
  CheckCircle2,
  X,
  Zap,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { fireConfetti as confetti } from '../lib/confetti';
import { PronunciationChallenge, UserStats } from '../types';
import { PronunciationWaveformVisualizer } from './PronunciationWaveformVisualizer';
import { requestMicrophoneStream, AudioRecorderService } from '../services/audioService';
import { StorageService } from '../services/storage';
import { SpeechService } from '../services/speechSynthesisService';
import { TutorVoiceWaveform } from './TutorVoiceWaveform';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';
import { playSfx } from '../services/soundEffects';
import { getLanguageConfig, normalizeUnicodeText } from '../config/languages';

interface PronunciationPracticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: string;
  onUpdateStats: (newStats: UserStats) => void;
  initialPhrase?: string;
}

export function calculatePronunciationMatchScore(
  targetPhrase: string,
  recognizedText: string,
  language: string
): number {
  const config = getLanguageConfig(language);
  const target = normalizeUnicodeText(targetPhrase);
  const recognized = normalizeUnicodeText(recognizedText);
  if (!target || !recognized) return 0;

  const tokenize = (text: string) => config.usesWhitespaceSegmentation
    ? text.split(/\s+/).filter(Boolean)
    : Array.from(text.replace(/\s/g, ''));
  const targetTokens = tokenize(target);
  const recognizedCounts = new Map<string, number>();
  tokenize(recognized).forEach((token) => {
    recognizedCounts.set(token, (recognizedCounts.get(token) ?? 0) + 1);
  });

  const matched = targetTokens.reduce((total, token) => {
    const remaining = recognizedCounts.get(token) ?? 0;
    if (remaining === 0) return total;
    recognizedCounts.set(token, remaining - 1);
    return total + 1;
  }, 0);

  return Math.min(100, Math.round((matched / targetTokens.length) * 100));
}

const DEFAULT_CHALLENGES: PronunciationChallenge[] = [
  {
    id: 'pron-1',
    frase: 'Connected speech makes English flow naturally.',
    pronuncia_ipa: '/kəˈnɛktɪd spiːtʃ meɪks ˈɪŋɡlɪʃ floʊ ˈnætʃrəli/',
    traducao: 'A fala encadeada faz o inglês fluir naturalmente.',
    dificuldade: 'medio',
    dica_articulacao:
      'Ligue a consoante final /d/ de "connected" com o /s/ de "speech" sem pausar. Reduza as vogais átonas com som de Schwa /ə/.',
    foco_fonetico: 'Connected Speech & Linking',
  },
  {
    id: 'pron-2',
    frase: 'Although he thought thoroughly, the answer was tough.',
    pronuncia_ipa: '/ɔːlˈðoʊ hiː θɔːt ˈθʌrəli, ði ˈænsər wʌz tʌf/',
    traducao: 'Embora tenha pensado minuciosamente, a resposta foi difícil.',
    dificuldade: 'dificil',
    dica_articulacao:
      'Diferencie o TH sonoro /ð/ em "although" do TH surdo /θ/ em "thought" e "thoroughly". O "gh" em "tough" soa como /f/.',
    foco_fonetico: 'Diferenciação de Sons do -OUGH e TH',
  },
  {
    id: 'pron-3',
    frase: 'I would particularly appreciate a comfortable schedule.',
    pronuncia_ipa: '/aɪ wʊd pərˈtɪkjələrli əˈpriːʃieɪt ə ˈkʌmftərbəl ˈskɛdʒuːl/',
    traducao: 'Eu apreciaria particularmente uma programação confortável.',
    dificuldade: 'dificil',
    dica_articulacao:
      'Em "comfortable", reduza para 3 sílabas (/ˈkʌmf.tər.bəl/), omitindo a segunda vogal "o" como os nativos fazem.',
    foco_fonetico: 'Elisão de Sílabas e Stress Timing',
  },
  {
    id: 'pron-4',
    frase: 'World vocabulary requires consistent daily immersion.',
    pronuncia_ipa: '/wɜːrld vəʊˈkæbjʊləri rɪˈkwaɪərz kənˈsɪstənt ˈdeɪli ɪˈmɜːrʒən/',
    traducao: 'O vocabulário mundial requer imersão diária consistente.',
    dificuldade: 'facil',
    dica_articulacao:
      'Atenção ao /r/ retroflexo seguido de /l/ em "world" (/wɜːrld/), sem adicionar som de "i" no final.',
    foco_fonetico: 'Vogais R-colored e Consoantes Finais',
  },
];

export const PronunciationPracticeModal: React.FC<PronunciationPracticeModalProps> = ({
  isOpen,
  onClose,
  language,
  onUpdateStats,
  initialPhrase,
}) => {
  const languageConfig = getLanguageConfig(language);
  const hasReadyChallenges = languageConfig.id === 'ingles';
  const [selectedChallenge, setSelectedChallenge] = useState<PronunciationChallenge>(
    DEFAULT_CHALLENGES[0]
  );
  const [customPhrase, setCustomPhrase] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);

  useEffect(() => {
    if (initialPhrase && initialPhrase.trim()) {
      setCustomPhrase(initialPhrase.trim());
      setIsCustomMode(true);
    } else if (!hasReadyChallenges) {
      setIsCustomMode(true);
    }
  }, [initialPhrase, isOpen, hasReadyChallenges]);

  // Estados de Gravação e Áudio
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSpeakingRef, setIsSpeakingRef] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<{
    score: number;
    transcricao_obtida: string;
    feedback_fonetico: string;
    melhorias: string[];
    xp_ganho: number;
  } | null>(null);

  const audioRecorderRef = useRef<AudioRecorderService | null>(null);

  useEffect(() => {
    const unsub = SpeechService.subscribe((playing, id) => {
      if (id === 'pron-ref') {
        setIsSpeakingRef(playing);
      } else if (!playing) {
        setIsSpeakingRef(false);
      }
    });
    return () => {
      unsub();
      stopMicrophoneStream();
    };
  }, []);

  const stopMicrophoneStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
  };

  const handleStartPractice = async () => {
    setEvaluationResult(null);
    try {
      if (!audioRecorderRef.current) {
        audioRecorderRef.current = new AudioRecorderService();
      }

      const stream = await requestMicrophoneStream();
      setMediaStream(stream);

      await audioRecorderRef.current.startRecording();
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao acessar microfone para prática:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
    }
  };

  const handleStopAndEvaluate = async () => {
    if (!audioRecorderRef.current || !isRecording) return;

    setIsRecording(false);
    setIsEvaluating(true);

    try {
      const targetPhrase = isCustomMode ? customPhrase : selectedChallenge.frase;
      const transcriptionRes = await audioRecorderRef.current.stopRecordingAndTranscribe(
        languageConfig.ttsLocale
      );
      stopMicrophoneStream();

      const baseScore = calculatePronunciationMatchScore(
        targetPhrase,
        transcriptionRes.text,
        language
      );
      const xpEarned = baseScore >= 80 ? 35 : baseScore > 0 ? 20 : 0;

      const evalData = {
        score: baseScore,
        transcricao_obtida:
          transcriptionRes.text || 'Não foi possível transcrever o áudio.',
        feedback_fonetico:
          baseScore >= 85
            ? 'A transcrição reconheceu toda a frase-alvo. Confira o áudio para avaliar ritmo e entonação.'
            : baseScore > 0
              ? 'Boa tentativa! Compare a transcrição capturada com a frase-alvo e pratique os trechos ausentes.'
              : 'Não houve transcrição suficiente para calcular uma pontuação confiável. Tente novamente em um ambiente mais silencioso.',
        melhorias: [
          isCustomMode
            ? 'Repita a frase mais devagar, articulando cada unidade antes de acelerar.'
            : selectedChallenge.dica_articulacao,
        ],
        xp_ganho: xpEarned,
      };

      setEvaluationResult(evalData);

      // Concede XP e atualiza progresso
      if (xpEarned > 0) StorageService.addXP(xpEarned);
      const measuredMinutes = Math.round(((transcriptionRes.durationSeconds ?? 0) / 60) * 100) / 100;
      if (measuredMinutes > 0) StorageService.recordMinutesStudied(measuredMinutes);
      onUpdateStats(StorageService.getStats());

      if (baseScore >= 80) {
        confetti({
          particleCount: 60,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10b981', '#6366f1', '#f59e0b'],
        });
      }
    } catch (e) {
      console.error(e);
      stopMicrophoneStream();
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleCancel = () => {
    if (audioRecorderRef.current) {
      audioRecorderRef.current.cancelRecording();
    }
    stopMicrophoneStream();
    setIsRecording(false);
  };

  const speakReference = (text: string) => {
    if (isSpeakingRef) {
      SpeechService.stop();
      setIsSpeakingRef(false);
      return;
    }
    setIsSpeakingRef(true);
    SpeechService.speak(
      text,
      {
        lang: languageConfig.ttsLocale,
        rate: 0.85,
        onEnd: () => setIsSpeakingRef(false),
        onError: () => setIsSpeakingRef(false),
      },
      'pron-ref'
    );
  };

  if (!isOpen) return null;

  const currentTarget = isCustomMode
    ? {
        frase: customPhrase || `Digite uma frase em ${languageConfig.displayName} para praticar.`,
        pronuncia_ipa: '',
        traducao: 'Frase personalizada',
        dificuldade: 'medio' as const,
        dica_articulacao: 'Pratique a entonação e clareza de cada palavra com calma.',
        foco_fonetico: 'Prática Livre',
      }
    : selectedChallenge;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border rounded-lg max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-4 my-auto relative text-card-foreground"
      >
        <CornerPlus />

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-mono font-bold text-xs shadow-2xs">
              PR
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
                  Treino de Pronúncia & Espectro de Áudio
                </h3>
                <div className="inline-flex items-center rounded border border-border bg-muted/60 px-2 py-0.5 font-mono text-[10px] font-semibold text-foreground uppercase">
                  AUDIO DSP
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                Visualize suas frequências vocais em tempo real e aprimore sua entonação em {languageConfig.displayName}.
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopMicrophoneStream();
              onClose();
            }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Seletor de Desafios ou Frase Personalizada */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase tracking-wider">
              Escolha uma frase ou desafio fonético:
            </span>
            {hasReadyChallenges && (
              <button
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-xs text-foreground hover:underline font-mono cursor-pointer"
              >
                {isCustomMode ? '[ Ver Desafios Prontos ]' : '[ Digitar Frase Própria ]'}
              </button>
            )}
          </div>

          {isCustomMode ? (
            <div className="space-y-1.5">
              <input
                type="text"
                value={customPhrase}
                onChange={(e) => setCustomPhrase(e.target.value)}
                placeholder={`Digite uma frase em ${languageConfig.displayName} para praticar sua pronúncia...`}
                className="w-full bg-background border border-border rounded-md p-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs font-mono"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEFAULT_CHALLENGES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedChallenge(c);
                    setEvaluationResult(null);
                  }}
                  className={`p-3 rounded-lg border text-left transition flex flex-col justify-between cursor-pointer ${
                    selectedChallenge.id === c.id
                      ? 'bg-muted/80 border-foreground ring-1 ring-foreground'
                      : 'bg-card border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] mb-1 font-mono font-bold">
                    <span className="text-foreground">{c.foco_fonetico}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded uppercase ${
                        c.dificuldade === 'facil'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : c.dificuldade === 'medio'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                          : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {c.dificuldade}
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-foreground line-clamp-1">{c.frase}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card da Frase Alvo com Reprodução Nativa */}
        <div className="p-4 bg-muted/40 border border-border text-foreground rounded-lg shadow-2xs space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
              FRASE ALVO PARA FALA
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => speakReference(currentTarget.frase)}
              className="text-xs font-mono gap-1.5 h-7 cursor-pointer"
              title="Ouvir pronúncia de referência com sotaque nativo"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>Ouvir Referência</span>
            </Button>
          </div>

          <h4 className="text-base sm:text-lg font-bold tracking-tight text-foreground leading-snug">
            "{currentTarget.frase}"
          </h4>

          {currentTarget.pronuncia_ipa && (
            <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground">
              <span>IPA:</span>
              <span className="bg-background border border-border px-2 py-0.5 rounded text-foreground font-mono">{currentTarget.pronuncia_ipa}</span>
            </div>
          )}

          <p className="text-xs text-muted-foreground font-mono">🇧🇷 {currentTarget.traducao}</p>

          {/* Onda Sonora em Tempo Real da Voz de Referência do Tutor */}
          {isSpeakingRef && (
            <TutorVoiceWaveform
              variant="inline"
              isPlaying={true}
              activeId="pron-ref"
              speed={0.85}
              onStop={() => {
                SpeechService.stop();
                setIsSpeakingRef(false);
              }}
            />
          )}

          <div className="pt-2 border-t border-border text-[11px] font-mono text-muted-foreground flex items-start space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-foreground" />
            <span>
              <strong className="text-foreground">Dica Fonética:</strong> {currentTarget.dica_articulacao}
            </span>
          </div>
        </div>

        {/* Visualizador de Onda de Áudio (Waveform) & Espectro em Tempo Real */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-foreground flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-foreground" />
              <span>Onda Vocal & Captação em Tempo Real (Waveform):</span>
            </span>
            {isRecording && (
              <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center space-x-1 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                <span>Microfone Ativo • Captação em Tempo Real</span>
              </span>
            )}
          </div>

          <PronunciationWaveformVisualizer
            stream={mediaStream}
            isActive={isRecording}
            height={90}
            mode="waveform"
            showControls={true}
            showMetrics={true}
            targetPhrase={currentTarget.frase}
            title="Captação da Onda Vocal do Estudante"
          />
        </div>

        {/* Controles de Gravação de Pronúncia */}
        <div className="flex items-center justify-between gap-3 pt-2">
          {!isRecording ? (
            <Button
              onClick={handleStartPractice}
              disabled={isEvaluating || (isCustomMode && !customPhrase.trim())}
              className="w-full py-2.5 font-mono text-xs sm:text-sm gap-2 cursor-pointer shadow-2xs"
            >
              <Mic className="w-4 h-4" />
              <span>Gravar Minha Pronúncia com Espectro</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <Button
                onClick={handleStopAndEvaluate}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs sm:text-sm gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Concluir e Verificar Transcrição</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                className="font-mono text-xs sm:text-sm cursor-pointer"
              >
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {isEvaluating && (
          <div className="p-3 bg-muted/60 border border-border rounded-lg text-xs font-mono text-foreground flex items-center justify-center space-x-2">
            <div className="w-3.5 h-3.5 rounded-full bg-foreground animate-spin" />
            <span>Transcrevendo o áudio e comparando com a frase-alvo...</span>
          </div>
        )}

        {/* Resultado da Transcrição */}
        <AnimatePresence>
          {evaluationResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-muted/30 border border-border rounded-lg space-y-3 text-xs font-mono"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-md bg-foreground text-background flex items-center justify-center font-bold">
                    {evaluationResult.score}%
                  </div>
                  <div>
                    <h5 className="font-bold text-foreground text-sm tracking-tight">
                      {evaluationResult.score >= 80 ? 'Frase reconhecida com clareza!' : 'Resultado da Transcrição'}
                    </h5>
                    <span className="text-[11px] text-muted-foreground">
                      Cobertura da frase-alvo na transcrição
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center rounded border border-border bg-foreground text-background px-2.5 py-1 font-mono text-xs font-bold shadow-2xs">
                  +{evaluationResult.xp_ganho} XP
                </div>
              </div>

              <div className="p-2.5 bg-card rounded-md border border-border text-foreground">
                <p className="font-medium">{evaluationResult.feedback_fonetico}</p>
                <p className="text-[11px] text-muted-foreground mt-1 font-mono">
                  <strong>O que foi capturado:</strong> "{evaluationResult.transcricao_obtida}"
                </p>
              </div>

              {evaluationResult.melhorias.length > 0 && (
                <div className="text-muted-foreground space-y-1">
                  <span className="font-bold text-foreground block">💡 Dica de Aperfeiçoamento:</span>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {evaluationResult.melhorias.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
