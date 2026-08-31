import { getLanguageConfig } from '../config/languages';
import { GeneratedStudyPlan, OnboardingAnswers, WeeklyPlanDay } from '../types';

interface SeedTerm {
  term: string;
  translation: string;
  example: string;
  ipa: string;
}

interface LanguageSeed {
  welcome: string;
  tutorLine: string;
  studentLine: string;
  terms: [SeedTerm, SeedTerm];
}

const LANGUAGE_SEEDS: Record<string, LanguageSeed> = {
  ingles: {
    welcome: 'Hello! Welcome to your study plan.',
    tutorLine: 'Hello! What would you like to practice today?',
    studentLine: 'I would like to practice a real travel situation.',
    terms: [
      { term: 'Hello', translation: 'Olá', example: 'Hello, nice to meet you.', ipa: '/həˈloʊ/' },
      { term: 'Thank you', translation: 'Obrigado', example: 'Thank you for your help.', ipa: '/ˈθæŋk juː/' },
    ],
  },
  espanhol: {
    welcome: '¡Hola! Bienvenido a tu plan de estudio.',
    tutorLine: '¡Hola! ¿Qué te gustaría practicar hoy?',
    studentLine: 'Me gustaría practicar una situación real de viaje.',
    terms: [
      { term: 'Hola', translation: 'Olá', example: 'Hola, mucho gusto.', ipa: '/ˈola/' },
      { term: 'Gracias', translation: 'Obrigado', example: 'Gracias por tu ayuda.', ipa: '/ˈɡɾa.sjas/' },
    ],
  },
  frances: {
    welcome: 'Bonjour ! Bienvenue dans votre programme d’étude.',
    tutorLine: 'Bonjour ! Qu’aimeriez-vous pratiquer aujourd’hui ?',
    studentLine: 'Je voudrais pratiquer une situation réelle de voyage.',
    terms: [
      { term: 'Bonjour', translation: 'Olá', example: 'Bonjour, enchanté !', ipa: '/bɔ̃.ʒuʁ/' },
      { term: 'Merci', translation: 'Obrigado', example: 'Merci pour votre aide.', ipa: '/mɛʁ.si/' },
    ],
  },
  alemao: {
    welcome: 'Hallo! Willkommen zu deinem Lernplan.',
    tutorLine: 'Hallo! Was möchtest du heute üben?',
    studentLine: 'Ich möchte eine echte Reisesituation üben.',
    terms: [
      { term: 'Hallo', translation: 'Olá', example: 'Hallo, schön dich kennenzulernen.', ipa: '/haˈloː/' },
      { term: 'Danke', translation: 'Obrigado', example: 'Danke für deine Hilfe.', ipa: '/ˈdaŋ.kə/' },
    ],
  },
  italiano: {
    welcome: 'Ciao! Benvenuto nel tuo piano di studio.',
    tutorLine: 'Ciao! Che cosa vorresti praticare oggi?',
    studentLine: 'Vorrei praticare una situazione reale di viaggio.',
    terms: [
      { term: 'Ciao', translation: 'Olá', example: 'Ciao, piacere di conoscerti.', ipa: '/ˈtʃa.o/' },
      { term: 'Grazie', translation: 'Obrigado', example: 'Grazie per il tuo aiuto.', ipa: '/ˈɡrat.tsje/' },
    ],
  },
  japones: {
    welcome: 'こんにちは！学習プランへようこそ。',
    tutorLine: 'こんにちは！今日は何を練習したいですか？',
    studentLine: '旅行で使う会話を練習したいです。',
    terms: [
      { term: 'こんにちは', translation: 'Olá', example: 'こんにちは、はじめまして。', ipa: '/koɲ.ɲi.tɕi.wa/' },
      { term: 'ありがとう', translation: 'Obrigado', example: '手伝ってくれて、ありがとう。', ipa: '/a.ɾi.ɡa.toː/' },
    ],
  },
};

const STYLE_LABELS: Record<OnboardingAnswers['estilo_aprendizado'], string> = {
  conversacao_voz: 'conversação e voz',
  vocabulario_flashcards: 'vocabulário e repetição espaçada',
  gramatica_pratica: 'gramática aplicada',
  equilibrio_completo: 'prática equilibrada',
};

function buildSchedule(minutes: number): WeeklyPlanDay[] {
  return [
    { dia_semana: 'Segunda-feira', foco: 'Vocabulário inicial', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Usar as primeiras expressões em contexto.' },
    { dia_semana: 'Terça-feira', foco: 'Revisão espaçada', duracao_minutos: minutes, tipo_atividade: 'flashcards', descricao_pratica: 'Revisar os termos gerados pelo plano.' },
    { dia_semana: 'Quarta-feira', foco: 'Diálogo situacional', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Simular uma situação ligada ao objetivo.' },
    { dia_semana: 'Quinta-feira', foco: 'Agilidade lexical', duracao_minutos: minutes, tipo_atividade: 'duel', descricao_pratica: 'Praticar os termos já registrados no grafo.' },
    { dia_semana: 'Sexta-feira', foco: 'Kit de estudo', duracao_minutos: minutes, tipo_atividade: 'materials', descricao_pratica: 'Revisar diálogo, exemplos e pronúncia.' },
    { dia_semana: 'Sábado', foco: 'Conversação livre', duracao_minutos: minutes, tipo_atividade: 'chat', descricao_pratica: 'Responder livremente usando o idioma-alvo.' },
    { dia_semana: 'Domingo', foco: 'Revisão leve', duracao_minutos: Math.max(10, Math.round(minutes / 2)), tipo_atividade: 'flashcards', descricao_pratica: 'Consolidar os termos da semana.' },
  ];
}

export function createFallbackStudyPlan(
  answers: OnboardingAnswers,
  now = new Date()
): GeneratedStudyPlan {
  const language = getLanguageConfig(answers.idioma_alvo);
  const seed = LANGUAGE_SEEDS[language.id];
  const createdAt = now.toISOString();
  const primaryInterest = answers.interesses[0];
  const focus = [
    answers.motivo_principal,
    answers.motivo_detalhado,
    primaryInterest,
  ].filter(Boolean).join(' · ');

  return {
    id: `plan-local-${now.getTime()}`,
    titulo_plano: `${answers.idioma_alvo} para ${answers.motivo_principal}`,
    descricao_plano: `Plano local de ${answers.tempo_diario_minutos} min/dia com foco em ${focus}.`,
    idioma: answers.idioma_alvo,
    nivel_cefr: answers.nivel_atual,
    meta_diaria_minutos: answers.tempo_diario_minutos,
    motivo_principal: answers.motivo_principal,
    interesses_principais: answers.interesses,
    estilo_aprendizado: answers.estilo_aprendizado,
    topico_inicial_recomendado: `${answers.idioma_alvo}: ${focus}`,
    mensagem_boas_vindas_tutor: `${seed.welcome} ${seed.tutorLine}`,
    estrategia_pedagogica: `Plano com ${STYLE_LABELS[answers.estilo_aprendizado]} e revisão progressiva.`,
    cronograma_semanal: buildSchedule(answers.tempo_diario_minutos),
    nos_iniciais_grafo: seed.terms.map((term, index) => ({
      id: `node-local-${language.id}-${index + 1}`,
      tipo: 'vocabulario',
      titulo: term.term,
      descricao: `Expressão inicial de ${answers.idioma_alvo}.`,
      dominio_estimado: 0,
      dificuldade: 1,
      frequencia_erro: 0,
      pronuncia_ipa: term.ipa,
      traducao: term.translation,
      exemplo_uso: term.example,
      idioma: answers.idioma_alvo,
    })),
    primeiro_material_estudo: {
      id: `material-local-${now.getTime()}`,
      titulo: `Guia inicial de ${answers.idioma_alvo}: ${answers.motivo_principal}`,
      tipo_fonte: 'texto',
      fonte_original: 'Plano local do assistente',
      idioma_alvo: answers.idioma_alvo,
      nivel_cefr: answers.nivel_atual,
      resumo: `Primeiro diálogo e vocabulário para ${focus}.`,
      vocabulario: seed.terms.map((term) => ({
        termo: term.term,
        traducao: term.translation,
        exemplo: term.example,
        pronuncia_ipa: term.ipa,
      })),
      gramatica: [],
      dialogo_pratica: [
        { personagem: 'Tutor', fala: seed.tutorLine },
        { personagem: 'Você', fala: seed.studentLine },
      ],
      questoes_compreensao: [{
        pergunta: `Como se usa “${seed.terms[0].term}”?`,
        resposta_correta: seed.terms[0].example,
        explicacao: `É uma expressão inicial de ${answers.idioma_alvo}.`,
      }],
      flashcards: seed.terms.map((term) => ({
        frente: term.term,
        verso: term.translation,
        dica: term.example,
      })),
      conteudo_markdown: `# ${answers.idioma_alvo}: ${answers.motivo_principal}\n\n${seed.tutorLine}\n\n${seed.studentLine}`,
      criado_em: createdAt,
      adicionado_ao_grafo: true,
    },
    dicas_personalizadas: [
      `Reserve ${answers.tempo_diario_minutos} minutos por dia.`,
      `Pratique em voz alta com foco em ${focus}.`,
    ],
    criado_em: createdAt,
  };
}
