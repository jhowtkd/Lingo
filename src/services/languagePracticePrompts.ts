import { getLanguageConfig } from '../config/languages';
import { GeneratedStudyPlan } from '../types';

type PlanPromptContext = Pick<GeneratedStudyPlan, 'motivo_principal'>;

const cleanTopic = (topic: string) =>
  topic.replace(/^(Francês|Inglês|Espanhol|Alemão|Italiano|Japonês):\s*/i, '');

export function buildQuickPrompts(
  language: string,
  topic: string,
  plan?: PlanPromptContext | null
): string[] {
  const config = getLanguageConfig(language);
  const focus = cleanTopic(topic);

  if (config.id === 'frances') {
    return [
      'Bonjour ! Comment puis-je me présenter naturellement en français ?',
      `Simule un dialogue pratique sur ${focus} en français.`,
      `Quelles sont les expressions clés pour ${focus} ?`,
      `Pose-moi une question en français sur ${plan?.motivo_principal || focus}.`,
    ];
  }

  if (config.id === 'espanhol') {
    return [
      `¡Hola! ¿Cómo puedo iniciar una conversación natural sobre ${focus}?`,
      `Simula un diálogo práctico sobre ${focus} en español.`,
      `¿Cuáles son las expresiones clave para ${focus}?`,
      `Hazme una pregunta en español sobre ${plan?.motivo_principal || focus}.`,
    ];
  }

  if (config.id === 'ingles') {
    return [
      `Hello! Let's start a conversation about ${focus}.`,
      `Simulate a practical roleplay about ${focus}.`,
      `What are the most natural expressions for ${focus}?`,
      `Ask me a question in English about ${plan?.motivo_principal || focus}.`,
    ];
  }

  return [
    `Vamos iniciar uma conversa em ${config.displayName} sobre ${focus}.`,
    `Simule um diálogo prático sobre ${focus} em ${config.displayName}.`,
    `Ensine expressões essenciais em ${config.displayName} para ${focus}.`,
    `Faça uma pergunta em ${config.displayName} sobre ${plan?.motivo_principal || focus}.`,
  ];
}

export interface ListenOnlyPrompt {
  label: string;
  prompt: string;
}

export function buildListenOnlyPrompts(language: string, topic: string): ListenOnlyPrompt[] {
  const config = getLanguageConfig(language);
  const focus = cleanTopic(topic);

  return [
    {
      label: '🎧 Exemplo natural',
      prompt: `Fale um exemplo natural em ${config.displayName} sobre ${focus} e destaque ritmo e pronúncia.`,
    },
    {
      label: '📝 Desafio de ditado',
      prompt: `Crie um desafio curto de ditado em ${config.displayName} sobre ${focus}, adequado ao meu nível.`,
    },
  ];
}
