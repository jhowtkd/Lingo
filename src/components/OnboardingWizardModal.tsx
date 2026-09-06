import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Globe,
  Compass,
  Briefcase,
  Plane,
  GraduationCap,
  Home as HomeIcon,
  MessageCircle,
  Sparkles,
  Clock,
  Flame,
  Brain,
  BookOpen,
  Swords,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Zap,
  Target,
  Layers,
  Calendar,
  Lightbulb,
  X,
  Volume2,
  Mic,
  Rocket,
  Check,
} from 'lucide-react';
import { fireConfetti as confetti } from '../lib/confetti';
import { CEFRLevel, GeneratedStudyPlan, OnboardingAnswers, UserStats } from '../types';
import { StorageService } from '../services/storage';
import { apiFetch } from '../lib/api';
import { LANGUAGE_THEMES } from '../services/languageThemes';
import { createFallbackStudyPlan } from '../services/studyPlanFallback';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap';

interface OnboardingWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlanApplied: (plan: GeneratedStudyPlan) => void;
  currentStats: UserStats;
}

const LANGUAGES = [
  { id: 'Inglês', label: 'Inglês', flag: '🇺🇸', sub: 'Global & Profissional' },
  { id: 'Espanhol', label: 'Espanhol', flag: '🇪🇸', sub: 'Américas & Europa' },
  { id: 'Francês', label: 'Francês', flag: '🇫🇷', sub: 'Cultura & Viagens' },
  { id: 'Alemão', label: 'Alemão', flag: '🇩🇪', sub: 'Engenharia & Carreira' },
  { id: 'Italiano', label: 'Italiano', flag: '🇮🇹', sub: 'Arte & Gastronomia' },
  { id: 'Japonês', label: 'Japonês', flag: '🇯🇵', sub: 'Tecnologia & Tradição' },
];

const CEFR_LEVELS: { id: CEFRLevel; label: string; desc: string; badge: string }[] = [
  { id: 'A1', label: 'Iniciante Absoluto (A1)', desc: 'Conheço poucas palavras ou estou começando do zero.', badge: 'Básico' },
  { id: 'A2', label: 'Básico / Elementar (A2)', desc: 'Entendo frases simples e consigo me apresentar.', badge: 'Elementar' },
  { id: 'B1', label: 'Intermediário (B1)', desc: 'Consigo manter conversas cotidianas e entender a ideia geral.', badge: 'Intermediário' },
  { id: 'B2', label: 'Independente (B2)', desc: 'Falo com boa fluência, mas quero destravar nuances e confiança.', badge: 'Independente' },
  { id: 'C1', label: 'Avançado / Fluente (C1)', desc: 'Compreendo expressões idiomáticas e busco sofisticação profissional.', badge: 'Avançado' },
];

const MOTIVES = [
  { id: 'Trabalho & Carreira', label: 'Trabalho & Carreira', icon: Briefcase, desc: 'Reuniões, apresentações, e-mails e negociações com equipes globais.' },
  { id: 'Viagens & Turismo', label: 'Viagens & Turismo', icon: Plane, desc: 'Aeroportos, hotéis, restaurantes e autonomia no exterior.' },
  { id: 'Estudos & Certificações', label: 'Estudos & Certificações', icon: GraduationCap, desc: 'TOEFL, IELTS, DELE, intercâmbios e artigos acadêmicos.' },
  { id: 'Morar no Exterior', label: 'Morar no Exterior', icon: HomeIcon, desc: 'Dia a dia prático, burocracias, saúde e integração comunitária.' },
  { id: 'Conversação & Hobby', label: 'Conversação & Hobby', icon: MessageCircle, desc: 'Desafio pessoal, fazer novos amigos e destravar a timidez.' },
  { id: 'Entrevistas de Emprego', label: 'Entrevistas de Emprego', icon: Target, desc: 'Pitch pessoal, storytelling de projetos e perguntas comportamentais.' },
];

const INTEREST_TOPICS = [
  { id: 'Tecnologia, IA & Programação', label: '💻 Tecnologia & IA' },
  { id: 'Negócios, Startups & Liderança', label: '🚀 Negócios & Startups' },
  { id: 'Filmes, Séries & Cultura Pop', label: '🎬 Séries & Filmes' },
  { id: 'Música & Podcasts', label: '🎵 Música & Podcasts' },
  { id: 'Gastronomia & Culinária', label: '🍳 Gastronomia' },
  { id: 'Viagens, Aventura & Natureza', label: '🌍 Viagens & Natureza' },
  { id: 'Ciência, Saúde & Inovação', label: '🔬 Ciência & Saúde' },
  { id: 'Vida Cotidiana & Amizades', label: '☕ Vida Cotidiana' },
  { id: 'Esportes & Fitness', label: '⚽ Esportes & Fitness' },
  { id: 'Games & Entretenimento', label: '🎮 Games & Geek' },
  { id: 'Economia & Finanças Pessoais', label: '📈 Finanças & Mercado' },
  { id: 'Design, Arte & Arquitetura', label: '🎨 Design & Artes' },
];

const TIME_OPTIONS = [
  { minutes: 10, label: '10 min/dia', badge: 'Casual', desc: 'Rápido e constante para dias corridos.' },
  { minutes: 15, label: '15 min/dia', badge: 'Consistente', desc: 'Ideal para manter o hábito sem sobrecarga.' },
  { minutes: 30, label: '30 min/dia', badge: 'Recomendado', desc: 'Equilíbrio perfeito entre fala, vocabulário e fixação.' },
  { minutes: 45, label: '45 min/dia', badge: 'Acelerado', desc: 'Progresso rápido com imersão diária aprofundada.' },
  { minutes: 60, label: '60 min/dia', badge: 'Intensivo', desc: 'Fluência acelerada para metas de curto prazo.' },
];

const LEARNING_STYLES = [
  { id: 'conversacao_voz' as const, label: 'Conversação & Voz', icon: Mic, desc: 'Prática oral contínua, feedback de fala e pronúncia natural.' },
  { id: 'vocabulario_flashcards' as const, label: 'Vocabulário & Memória', icon: Layers, desc: 'Expansão de palavras, repetição espaçada SM-2 e collocations.' },
  { id: 'gramatica_pratica' as const, label: 'Gramática sem Travar', icon: Brain, desc: 'Padrões práticos de frases e superação de vícios de tradução.' },
  { id: 'equilibrio_completo' as const, label: 'Trilha Completa Integrada', icon: Sparkles, desc: 'Equilíbrio de diálogo ao vivo, kits de estudo e desafios rápidos.' },
];

export const OnboardingWizardModal: React.FC<OnboardingWizardModalProps> = ({
  isOpen,
  onClose,
  onPlanApplied,
  currentStats,
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(currentStats.idioma_ativo || 'Inglês');
  const [selectedLevel, setSelectedLevel] = useState<CEFRLevel>(currentStats.nivel_cefr || 'B1');
  const [selectedMotive, setSelectedMotive] = useState<string>('Trabalho & Carreira');
  const [customMotiveDetail, setCustomMotiveDetail] = useState<string>('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [customInterestInput, setCustomInterestInput] = useState<string>('');
  const [dailyMinutes, setDailyMinutes] = useState<number>(currentStats.meta_diaria_minutos || 30);
  const [learningStyle, setLearningStyle] = useState<
    'conversacao_voz' | 'vocabulario_flashcards' | 'gramatica_pratica' | 'equilibrio_completo'
  >('conversacao_voz');

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationStepText, setGenerationStepText] = useState<string>('Analisando preferências...');
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedStudyPlan | null>(null);
  const [generationSource, setGenerationSource] = useState<'api' | 'local' | null>(null);
  const dialogRef = useModalFocusTrap<HTMLDivElement>(isOpen, onClose);

  if (!isOpen) return null;

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter((i) => i !== interest));
    } else {
      if (selectedInterests.length < 5) {
        setSelectedInterests([...selectedInterests, interest]);
      }
    }
  };

  const handleAddCustomInterest = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      selectedInterests.length < 5 &&
      customInterestInput.trim() &&
      !selectedInterests.includes(customInterestInput.trim())
    ) {
      setSelectedInterests([...selectedInterests, customInterestInput.trim()]);
      setCustomInterestInput('');
    }
  };

  const handleGeneratePlan = async () => {
    if (selectedInterests.length === 0) return;

    setIsGenerating(true);
    setGenerationStepText(`Calibrando currículo de ${selectedLanguage} para nível ${selectedLevel}...`);

    const answers: OnboardingAnswers = {
      idioma_alvo: selectedLanguage,
      nivel_atual: selectedLevel,
      motivo_principal: selectedMotive,
      motivo_detalhado: customMotiveDetail.trim(),
      interesses: selectedInterests,
      tempo_diario_minutos: dailyMinutes,
      estilo_aprendizado: learningStyle,
    };

    // Animação de etapas para dar sensação refinada de IA sob medida
    const timer1 = setTimeout(() => {
      setGenerationStepText('Gerando primeiros nós de memória para o Grafo Relacional...');
    }, 900);

    const timer2 = setTimeout(() => {
      setGenerationStepText('Montando kit inicial de estudos com vocabulário de ouro e diálogo...');
    }, 1800);

    const timer3 = setTimeout(() => {
      setGenerationStepText('Estruturando cronograma semanal de 7 dias...');
    }, 2700);

    try {
      const response = await apiFetch('/api/onboarding/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answers),
      });
      if (!response.ok) {
        throw new Error(`Falha ao gerar plano: ${response.status}`);
      }

      const data = await response.json();

      if (data.plano) {
        const plan: GeneratedStudyPlan = {
          ...data.plano,
          estilo_aprendizado: answers.estilo_aprendizado,
        };
        setGeneratedPlan(plan);
        setGenerationSource('api');
        setStep(5); // Tela de Apresentação do Plano
        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.6 },
        });
      } else {
        throw new Error('Formato inválido de plano recebido');
      }
    } catch (err) {
      console.warn('Erro ao gerar plano via API, aplicando fallback estruturado:', err);
      setGeneratedPlan(createFallbackStudyPlan(answers));
      setGenerationSource('local');
      setStep(5);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setIsGenerating(false);
    }
  };

  const handleApplyAndStart = () => {
    if (!generatedPlan) return;
    StorageService.applyGeneratedPlan(generatedPlan);
    onPlanApplied(generatedPlan);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-[oklch(0.25_0.05_280_/_0.55)] backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-dialog-title"
        tabIndex={-1}
        className="relative bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-xl)] max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-[var(--shadow)] text-[var(--fg)] max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header com Stepper e Botão Fechar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 shrink-0">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-extrabold text-[var(--accent-deep)]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ASSISTENTE DE CONFIGURAÇÃO INICIAL</span>
            </div>
            <h2 id="onboarding-dialog-title" className="text-xl sm:text-2xl font-bold font-display text-[var(--fg)]">
              {step === 1 && 'Escolha seu Idioma & Nível'}
              {step === 2 && 'Qual é o seu Objetivo Principal?'}
              {step === 3 && 'Seus Interesses & Afinidades'}
              {step === 4 && 'Tempo Diário & Estilo de Prática'}
              {step === 5 && '✨ Seu Plano de Estudos Personalizado'}
            </h2>
          </div>

          <button
            onClick={onClose}
            aria-label="Fechar configuração"
            className="p-2 rounded-full text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.95_0.01_84)] transition cursor-pointer"
            title="Fechar assistente"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso do Stepper (1 a 4) */}
        {step <= 4 && (
          <div className="space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
              <span>Etapa {step} de 4</span>
              <span>{Math.round((step / 4) * 100)}% concluído</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--border)] overflow-hidden">
              <div
                className="h-full bg-[var(--accent-deep)] transition-all duration-300 rounded-full"
                style={{ width: `${(step / 4) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Conteúdo Dinâmico com AnimatePresence */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-6">
          <AnimatePresence mode="wait">
            {/* ETAPA 1: Idioma Alvo & Nível */}
            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Seleção de Idioma */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Qual idioma você quer aprender ou aperfeiçoar agora?</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {LANGUAGES.map((lang) => {
                      const isSelected = selectedLanguage === lang.id;
                      return (
                        <button
                          key={lang.id}
                          type="button"
                          onClick={() => setSelectedLanguage(lang.id)}
                          className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface)] border-[var(--accent-deep)] ring-2 ring-[var(--accent-soft)] shadow-sm'
                              : 'bg-[oklch(0.97_0.008_84)] border-transparent hover:border-[var(--border)]'
                          }`}
                        >
                          <span className="text-2xl">{lang.flag}</span>
                          <div className="min-w-0">
                            <span className="block font-bold text-sm text-[var(--fg)] leading-tight">
                              {lang.label}
                            </span>
                            <span className="block text-[11px] text-[var(--muted)] truncate">
                              {lang.sub}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Seleção de Nível CEFR */}
                <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Compass className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Como você avalia seu domínio atual em {selectedLanguage}?</span>
                  </label>
                  <div className="space-y-2">
                    {CEFR_LEVELS.map((lvl) => {
                      const isSelected = selectedLevel === lvl.id;
                      return (
                        <button
                          key={lvl.id}
                          type="button"
                          onClick={() => setSelectedLevel(lvl.id)}
                          className={`w-full p-3.5 rounded-xl border-2 text-left transition flex items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface)] border-[var(--accent-deep)] ring-2 ring-[var(--accent-soft)] shadow-sm'
                              : 'bg-[oklch(0.97_0.008_84)] border-transparent hover:border-[var(--border)]'
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-[var(--fg)]">{lvl.label}</span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--muted)]">
                                {lvl.badge}
                              </span>
                            </div>
                            <p className="text-xs text-[var(--muted)] leading-relaxed">{lvl.desc}</p>
                          </div>
                          {isSelected && (
                            <div className="w-6 h-6 rounded-full bg-[var(--accent-deep)] text-white flex items-center justify-center shrink-0">
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPA 2: Motivo / Objetivo */}
            {step === 2 && (
              <motion.div
                key="step-2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-3">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Target className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Qual é a sua principal motivação para dominar {selectedLanguage}?</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {MOTIVES.map((motive) => {
                      const Icon = motive.icon;
                      const isSelected = selectedMotive === motive.id;
                      return (
                        <button
                          key={motive.id}
                          type="button"
                          onClick={() => setSelectedMotive(motive.id)}
                          className={`p-4 rounded-xl border-2 text-left transition flex items-start gap-3.5 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface)] border-[var(--accent-deep)] ring-2 ring-[var(--accent-soft)] shadow-sm'
                              : 'bg-[oklch(0.97_0.008_84)] border-transparent hover:border-[var(--border)]'
                          }`}
                        >
                          <div
                            className={`p-2.5 rounded-lg shrink-0 ${
                              isSelected
                                ? 'bg-[var(--accent-deep)] text-white'
                                : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'
                            }`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-sm text-[var(--fg)]">
                              {motive.label}
                            </span>
                            <span className="block text-xs text-[var(--muted)] leading-relaxed mt-0.5">
                              {motive.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Detalhe Opcional do Objetivo */}
                <div className="space-y-2 pt-3 border-t border-[var(--border)]">
                  <label className="text-xs font-bold text-[var(--fg)] block">
                    Quer detalhar alguma meta específica? (Opcional)
                  </label>
                  <input
                    type="text"
                    value={customMotiveDetail}
                    onChange={(e) => setCustomMotiveDetail(e.target.value)}
                    placeholder="Ex: Falar em reuniões diárias de engenharia, apresentar produtos para clientes, etc."
                    className="w-full bg-[var(--surface)] border-2 border-[var(--border)] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                  />
                </div>
              </motion.div>
            )}

            {/* ETAPA 3: Interesses & Afinidades */}
            {step === 3 && (
              <motion.div
                key="step-3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Quais assuntos prendem a sua atenção? (Escolha de 1 a 5)</span>
                  </label>
                  <p className="text-xs text-[var(--muted)]">
                    O tutor utilizará estes temas reais para gerar seus diálogos, materiais e termos de vocabulário.
                  </p>
                </div>

                {/* Pills de Interesses */}
                <div className="flex flex-wrap gap-2.5">
                  {INTEREST_TOPICS.map((item) => {
                    const isSelected = selectedInterests.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleInterest(item.id)}
                        className={`px-3.5 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border ${
                          isSelected
                            ? 'bg-[var(--fg)] text-white border-[var(--fg)] shadow-xs scale-102'
                            : 'bg-[oklch(0.965_0.01_84)] border-transparent text-[var(--fg)] hover:bg-[oklch(0.93_0.02_84)]'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                    );
                  })}
                </div>

                {/* Adicionar Interesse Livre */}
                <form onSubmit={handleAddCustomInterest} className="space-y-2 pt-4 border-t border-[var(--border)]">
                  <label className="text-xs font-bold text-[var(--fg)] block">
                    Adicionar outro interesse personalizado:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customInterestInput}
                      onChange={(e) => setCustomInterestInput(e.target.value)}
                      placeholder="Ex: Fórmula 1, Fotografia Analógica, Inteligência Emocional..."
                      className="flex-1 bg-[var(--surface)] border-2 border-[var(--border)] rounded-full px-4 py-2 text-xs sm:text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--accent-deep)]"
                    />
                    <button
                      type="submit"
                      disabled={!customInterestInput.trim()}
                      className="px-5 py-2 rounded-full font-extrabold text-xs bg-[var(--accent-soft)] text-[var(--accent-deep)] hover:bg-[var(--accent)] hover:text-[var(--fg)] transition disabled:opacity-50 cursor-pointer"
                    >
                      Adicionar
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* ETAPA 4: Tempo Diário & Estilo de Aprendizado */}
            {step === 4 && (
              <motion.div
                key="step-4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Tempo Disponível por Dia */}
                <div className="space-y-3">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Quanto tempo você tem disponível por dia para praticar?</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                    {TIME_OPTIONS.map((t) => {
                      const isSelected = dailyMinutes === t.minutes;
                      return (
                        <button
                          key={t.minutes}
                          type="button"
                          onClick={() => setDailyMinutes(t.minutes)}
                          className={`p-3 rounded-xl border-2 text-center transition flex flex-col items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface)] border-[var(--accent-deep)] ring-2 ring-[var(--accent-soft)] shadow-sm'
                              : 'bg-[oklch(0.97_0.008_84)] border-transparent hover:border-[var(--border)]'
                          }`}
                        >
                          <span className="text-base font-extrabold text-[var(--fg)]">{t.label}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-deep)] mt-1">
                            {t.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Estilo de Prática Preferido */}
                <div className="space-y-3 pt-4 border-t border-[var(--border)]">
                  <label className="text-sm font-bold text-[var(--fg)] flex items-center gap-2">
                    <Brain className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Qual foco de prática você prefere priorizar?</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {LEARNING_STYLES.map((style) => {
                      const Icon = style.icon;
                      const isSelected = learningStyle === style.id;
                      return (
                        <button
                          key={style.id}
                          type="button"
                          onClick={() => setLearningStyle(style.id)}
                          className={`p-3.5 rounded-xl border-2 text-left transition flex items-start gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-[var(--surface)] border-[var(--accent-deep)] ring-2 ring-[var(--accent-soft)] shadow-sm'
                              : 'bg-[oklch(0.97_0.008_84)] border-transparent hover:border-[var(--border)]'
                          }`}
                        >
                          <div
                            className={`p-2 rounded-lg shrink-0 ${
                              isSelected
                                ? 'bg-[var(--accent-deep)] text-white'
                                : 'bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="block font-bold text-sm text-[var(--fg)]">
                              {style.label}
                            </span>
                            <span className="block text-[11px] text-[var(--muted)] leading-relaxed mt-0.5">
                              {style.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* ETAPA 5: Visualização do Plano Gerado (Resultado da IA) */}
            {step === 5 && generatedPlan && (
              <motion.div
                key="step-5"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Banner de Sucesso do Plano */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[oklch(0.96_0.02_84)] border-2 border-[var(--accent-deep)] shadow-sm space-y-3 text-left">
                  {generationSource === 'local' && (
                    <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 p-3 text-xs text-amber-900">
                      A IA não respondeu desta vez. Criamos um plano local com as preferências que você informou; você pode revisar antes de aplicar.
                    </div>
                  )}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent)] text-[var(--fg)] font-extrabold text-xs">
                      <Rocket className="w-3.5 h-3.5" />
                      <span>PLANO PRONTO PARA ATIVAÇÃO</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-bold text-[var(--muted)]">
                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)]">
                        {generatedPlan.idioma} · Nível {generatedPlan.nivel_cefr}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--accent-deep)]">
                        ⏱️ {generatedPlan.meta_diaria_minutos} min/dia
                      </span>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold font-display text-[var(--fg)]">
                    {generatedPlan.titulo_plano}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                    {generatedPlan.descricao_plano}
                  </p>

                  <div className="pt-2 border-t border-[var(--border)] flex items-center gap-2 text-xs text-[var(--fg)] font-semibold">
                    <Sparkles className="w-4 h-4 text-[var(--accent-deep)] shrink-0" />
                    <span>
                      Tópico de conversação inicial: <strong>{generatedPlan.topico_inicial_recomendado}</strong>
                    </span>
                  </div>
                </div>

                {/* Destaque dos Primeiros Conteúdos Gerados */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                  {/* Card 1: Primeiros Nós de Grafo */}
                  <div className="p-4 rounded-xl bg-[oklch(0.975_0.008_84)] border border-[var(--border)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-deep)] flex items-center gap-1.5">
                        <Brain className="w-4 h-4" />
                        <span>Grafo de Memória Inicial ({generatedPlan.nos_iniciais_grafo.length} termos)</span>
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {generatedPlan.nos_iniciais_grafo.slice(0, 3).map((node, idx) => (
                        <div
                          key={idx}
                          className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs"
                        >
                          <div>
                            <strong className="text-[var(--fg)] block">{node.titulo}</strong>
                            <span className="text-[11px] text-[var(--muted)]">{node.traducao}</span>
                          </div>
                          {node.pronuncia_ipa && (
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[oklch(0.95_0.01_84)] text-[var(--muted)]">
                              {node.pronuncia_ipa}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Primeiro Kit de Estudos */}
                  <div className="p-4 rounded-xl bg-[oklch(0.975_0.008_84)] border border-[var(--border)] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent-deep)] flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4" />
                        <span>Primeiro Kit de Estudos</span>
                      </span>
                    </div>
                    <div className="p-3 rounded-lg bg-[var(--surface)] border border-[var(--border)] space-y-1.5 text-xs">
                      <strong className="text-[var(--fg)] block leading-snug">
                        {generatedPlan.primeiro_material_estudo?.titulo}
                      </strong>
                      <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-relaxed">
                        {generatedPlan.primeiro_material_estudo?.resumo}
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-[10px] text-[var(--muted)] font-semibold">
                        <span>🏷️ {generatedPlan.primeiro_material_estudo?.vocabulario?.length || 0} vocabulários</span>
                        <span>·</span>
                        <span>🗂️ {generatedPlan.primeiro_material_estudo?.flashcards?.length || 0} flashcards</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cronograma Semanal de 7 Dias */}
                <div className="space-y-2 text-left">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--fg)] flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-[var(--accent-deep)]" />
                    <span>Cronograma dos Primeiros 7 Dias</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                    {generatedPlan.cronograma_semanal.map((day, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1 text-xs"
                      >
                        <span className="font-extrabold text-[var(--accent-deep)] block text-[11px]">
                          {day.dia_semana}
                        </span>
                        <strong className="text-[var(--fg)] block truncate">{day.foco}</strong>
                        <p className="text-[10px] text-[var(--muted)] line-clamp-2">{day.descricao_pratica}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tela de Loading / Geração com IA */}
          {isGenerating && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-[var(--accent-soft)] border-t-[var(--accent-deep)] animate-spin" />
                <Sparkles className="w-6 h-6 text-[var(--accent-deep)] absolute inset-0 m-auto animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold font-display text-base text-[var(--fg)]">
                  Criando seu Plano Personalizado...
                </h3>
                <p className="text-xs text-[var(--muted)] font-mono animate-fade-in">
                  {generationStepText}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Botões de Navegação */}
        {!isGenerating && (
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-4 shrink-0">
            {step > 1 && step <= 4 ? (
              <button
                type="button"
                onClick={() => setStep(step - 1)}
                className="px-4 py-2.5 rounded-full font-bold text-xs border border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] transition flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar</span>
              </button>
            ) : (
              <div />
            )}

            {step < 4 && (
              <button
                type="button"
                onClick={() => setStep(step + 1)}
                className="px-6 py-2.5 rounded-full font-extrabold text-xs sm:text-sm bg-[var(--fg)] text-white hover:bg-[oklch(0.2_0.05_280)] transition flex items-center gap-2 shadow-sm cursor-pointer ml-auto"
              >
                <span>Avançar</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {step === 4 && (
              <div className="ml-auto flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={selectedInterests.length === 0}
                  className="px-6 py-2.5 rounded-full font-extrabold text-xs sm:text-sm bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition flex items-center gap-2 shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Gerar Meu Primeiro Plano com IA</span>
                </button>
                {selectedInterests.length === 0 && (
                  <span className="text-xs font-semibold text-amber-800">Selecione pelo menos um interesse</span>
                )}
              </div>
            )}

            {step === 5 && (
              <div className="flex items-center gap-2.5 w-full justify-end">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2.5 rounded-full font-bold text-xs border border-[var(--border)] text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] transition cursor-pointer"
                >
                  Refazer Respostas
                </button>
                <button
                  type="button"
                  onClick={handleApplyAndStart}
                  className="px-6 py-3 rounded-full font-extrabold text-xs sm:text-sm bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition flex items-center gap-2 shadow-[0_4px_0_oklch(0.55_0.15_48)] cursor-pointer"
                >
                  <Rocket className="w-4 h-4" />
                  <span>Aplicar Plano & Começar Agora</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
