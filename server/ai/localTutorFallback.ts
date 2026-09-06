export interface LocalTutorResponse {
  resposta_tutor: string;
  possui_erro: boolean;
  adaptacao: {
    nivel: 'fundamental_analogico' | 'intermediario_aplicado' | 'avancado_analitico';
    rotulo: string;
    dominio_avaliado: number;
    justificativa: string;
    estrategia_pedagogica: string;
    conceitos_relacionados: string[];
  };
  correcao?: {
    conceito: string;
    erro: string;
    explicacao: string;
    resposta_corrigida: string;
    gravidade: 'leve' | 'moderada' | 'critica';
    evidencia: string;
    pergunta_confirmacao: string;
    dica_pronuncia_ou_gramatica?: string;
  };
  novos_nos_grafo: Array<{
    tipo: 'vocabulario' | 'expressao_idiomatica' | 'falso_amigo' | 'gramatica';
    titulo: string;
    descricao: string;
    dominio_estimado: number;
    dificuldade: number;
    evidencia?: string;
    relacionado_com?: string;
    tipo_relacao?: 'relacionado_a' | 'dificuldade_em' | 'pre_requisito_de';
    traducao?: string;
    exemplo_uso?: string;
    frequencia_erro?: number;
  }>;
  xp_ganho: number;
  conceitos_chave: string[];
}

export function generateLocalLanguageTutorResponse(
  mensagem: string,
  topico: string,
  idiomaAlvo: string,
  contextoGrafo: any[] = [],
  preferenciaAdaptacao?: string,
  planoEstudo?: any
): LocalTutorResponse {
  const lower = (mensagem || '').toLowerCase();
  const hasCommonPortugueseTransfer =
    lower.includes('make a question') ||
    lower.includes('i have 20 years') ||
    lower.includes('depend of') ||
    lower.includes('actually') ||
    lower.includes('pretend') ||
    lower.includes('intend') ||
    lower.includes('lose time');

  const totalDominio = (contextoGrafo || []).reduce(
    (acc: number, n: any) => acc + (n.dominio_estimado || 50),
    0
  );
  const avgDominio =
    contextoGrafo?.length > 0 ? Math.round(totalDominio / contextoGrafo.length) : 62;

  if (hasCommonPortugueseTransfer) {
    const isFrench = idiomaAlvo.toLowerCase().includes('franc');
    const isSpanish = idiomaAlvo.toLowerCase().includes('espanh');

    return {
      resposta_tutor: `Muito bom você tentar formular a frase em **${idiomaAlvo}**! Notei um detalhe sutil de interferência do português: em ${
        isFrench
          ? 'francês, dizemos *"poser une question"*'
          : isSpanish
          ? 'espanhol, dizemos *"hacer una pregunta"* ou *"tengo 20 años"*'
          : 'inglês, dizemos *"ask a question"* (e não "make a question") ou *"I am 20 years old"*'
      }. Vamos tentar reformular?`,
      possui_erro: true,
      adaptacao: {
        nivel: 'fundamental_analogico',
        rotulo: 'A1/A2 - Básico com Dicas de Falsos Amigos',
        dominio_avaliado: Math.min(avgDominio, 50),
        justificativa: `Grafo detectou padrão de tradução literal do Português no tópico ${topico}.`,
        estrategia_pedagogica:
          'Alinhamento de collocations nativas e falsos cognatos com reforço positivo.',
        conceitos_relacionados: [topico, 'Collocations', 'False Friends'],
      },
      correcao: {
        conceito: 'Collocation e Padrão Idiomático',
        erro: 'Tradução literal direta da estrutura do português',
        explicacao: `Em ${idiomaAlvo}, certas combinações de palavras (collocations) são fixas. Por exemplo, usamos estruturas próprias para perguntas e descrições.`,
        resposta_corrigida: isFrench
          ? `Je voudrais poser une question sur ${topico}.`
          : isSpanish
          ? `Me gustaría hacer una pregunta sobre ${topico}.`
          : `I would like to ask a question regarding ${topico}.`,
        gravidade: 'leve',
        evidencia: mensagem,
        pergunta_confirmacao: `Como você diria agora "Posso fazer uma pergunta sobre isso?" em ${idiomaAlvo}?`,
        dica_pronuncia_ou_gramatica: `Dica de ritmo: mantenha a entonação natural da frase em ${idiomaAlvo}.`,
      },
      novos_nos_grafo: [
        {
          tipo: 'falso_amigo',
          titulo: `Padrão de Uso em ${idiomaAlvo}`,
          descricao: `Ajuste de uso natural identificado na prática: "${mensagem.slice(0, 50)}"`,
          dominio_estimado: 55,
          dificuldade: 2,
          evidencia: mensagem,
          relacionado_com: topico,
          tipo_relacao: 'dificuldade_em',
          traducao: `Expressão natural em ${idiomaAlvo}`,
          exemplo_uso: isFrench
            ? 'Puis-je vous poser une question ?'
            : isSpanish
            ? '¿Puedo hacerte una pregunta?'
            : 'Can I ask you a quick question?',
          frequencia_erro: 1,
        },
      ],
      xp_ganho: 25,
      conceitos_chave: [topico, 'Natural Collocations'],
    };
  }

  const isAdvanced = avgDominio >= 80 || preferenciaAdaptacao === 'avancado_analitico';

  const responsesByLang: Record<string, { advanced: string; standard: string }> = {
    'Francês': {
      advanced: `Très bien formulé ! Votre phrase en **Français** est claire et naturelle. Pour aller encore plus loin dans notre thème **${topico}**, comment exprimeriez-vous cette idée dans une conversation fluide ?`,
      standard: `C'est une excellente phrase en **Français** ! Vous avez bien communiqué votre intention sur le thème **${topico}**. Que diriez-vous si nous continuions avec une question pratique ?`,
    },
    'Espanhol': {
      advanced: `¡Excelente formulación! Tu estructura en **Español** es muy natural y fluida. Para avanzar en **${topico}**, ¿cómo expresarías esto en un contexto formal o cotidiano?`,
      standard: `¡Muy bien! Tu frase en **Español** se entiende perfectamente para practicar **${topico}**. ¿Qué te gustaría añadir o preguntar a continuación?`,
    },
    'Inglês': {
      advanced: `That was spot on! Your sentence structure in **English** is very natural and articulate. To elevate it further in **${topico}**, how would you express this in a professional or spontaneous context?`,
      standard: `Great sentence in **English**! You communicated your idea clearly regarding **${topico}**. To practice even more, how would you describe a personal experience or ask me a follow-up question about this?`,
    },
    'Alemão': {
      advanced: `Sehr gut formuliert! Dein Satz auf **Deutsch** ist klar und präzise. Lass uns das Thema **${topico}** vertiefen: Wie würdest du das weiter ausführen?`,
      standard: `Sehr gut! Dein Satz auf **Deutsch** passt super zum Thema **${topico}**. Was möchtest du als Nächstes fragen oder sagen?`,
    },
    'Italiano': {
      advanced: `Ottima formulazione! La tua frase in **Italiano** è molto naturale. Per approfondire il tema **${topico}**, come esprimeresti questo concetto in un contesto quotidiano?`,
      standard: `Molto bene! La tua frase in **Italiano** è chiarissima per parlare di **${topico}**. Continuiamo con un altro esempio pratico?`,
    },
  };

  const langResponses = responsesByLang[idiomaAlvo] || {
    advanced: `Ótima formulação em **${idiomaAlvo}**! A estrutura foi muito bem empregada no tópico **${topico}**. Como você continuaria desenvolvendo essa ideia?`,
    standard: `Muito bem em **${idiomaAlvo}**! Você se expressou com clareza no tema **${topico}**. Vamos dar o próximo passo prático?`,
  };

  return {
    resposta_tutor: isAdvanced ? langResponses.advanced : langResponses.standard,
    possui_erro: false,
    adaptacao: {
      nivel: isAdvanced ? 'avancado_analitico' : 'intermediario_aplicado',
      rotulo: isAdvanced
        ? 'C1/C2 - Avançado e Fluência Idiomática'
        : 'B1/B2 - Intermediário Conversacional',
      dominio_avaliado: avgDominio,
      justificativa: isAdvanced
        ? `Grafo identificou alto domínio lexical (${avgDominio}%) em ${idiomaAlvo}.`
        : `Grafo identificou boa compreensão prática (${avgDominio}%) em ${idiomaAlvo}.`,
      estrategia_pedagogica: isAdvanced
        ? 'Refinamento estilístico, idioms e precisão contextual.'
        : 'Prática de conversação ativa e consolidação de vocabulário.',
      conceitos_relacionados: [topico],
    },
    novos_nos_grafo: [
      {
        tipo: 'vocabulario',
        titulo: `Expressão em ${topico}`,
        descricao: `Compreensão demonstrada com sucesso na conversa em ${idiomaAlvo}.`,
        dominio_estimado: Math.min(100, avgDominio + 6),
        dificuldade: 2,
        evidencia: mensagem,
        relacionado_com: topico,
        tipo_relacao: 'relacionado_a',
        traducao: `Vocabulário chave de ${idiomaAlvo}`,
        frequencia_erro: 0,
      },
    ],
    xp_ganho: 30,
    conceitos_chave: [topico, `${idiomaAlvo} Practice`],
  };
}
