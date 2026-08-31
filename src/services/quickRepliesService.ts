export interface ReplyTipOption {
  id: string;
  intent: string; // Ex: 'Você pode responder assim (concordando e justificando):' ou 'Você pode responder assado (trazendo sua opinião):'
  category: 'concordar' | 'opinar' | 'perguntar' | 'exemplo' | 'contrapor';
  template: string; // Ex: "I totally agree with this because [complete com seu motivo]..."
  starterText: string; // Ex: "I totally agree with this because " (insere no input para o aluno redigir seu próprio pensamento)
  translation: string; // Ex: "Concordo totalmente com isso porque..."
  pedagogicalNote: string; // Ex: "Ensina a estruturar justificativas formais e usar conectivos causais."
  icon?: string;
}

export class QuickRepliesService {
  /**
   * Gera modelos didáticos de resposta para ensinar o estudante a formular
   * suas próprias frases (sem responder por ele).
   */
  static generateTips(
    lastTutorMessage: string | undefined,
    currentTopic: string,
    language = 'Inglês'
  ): ReplyTipOption[] {
    const lang = language.toLowerCase();
    const cleanTutorText = (lastTutorMessage || '').toLowerCase();

    // 1. Francês
    if (lang.includes('francês') || lang.includes('french') || lang.includes('frances')) {
      return [
        {
          id: 'fr-agree',
          intent: 'Você pode responder assim (concordando):',
          category: 'concordar',
          template: '« Oui, je suis tout à fait d’accord parce que [votre raison]... »',
          starterText: "Oui, je suis tout à fait d'accord parce que ",
          translation: 'Sim, concordo totalmente porque...',
          pedagogicalNote: 'Ensina a usar conectivos de causa ("parce que") para justificar argumentos.',
          icon: '👍',
        },
        {
          id: 'fr-opinion',
          intent: 'Ou responder assado (dando sua visão):',
          category: 'opinar',
          template: '« Selon mon expérience personnelle, je trouve que [votre avis]... »',
          starterText: 'Selon mon expérience personnelle, je trouve que ',
          translation: 'Pela minha experiência pessoal, acho que...',
          pedagogicalNote: 'Ensina a introduzir pontos de vista pessoais com naturalidade.',
          icon: '💭',
        },
        {
          id: 'fr-example',
          intent: 'Ou pedir aplicação prática:',
          category: 'exemplo',
          template: '« Pourrais-tu me montrer comment utiliser cela dans [situation] ? »',
          starterText: 'Pourrais-tu me donner un exemple concret avec ',
          translation: 'Poderia me dar um exemplo concreto com...?',
          pedagogicalNote: 'Estimula o pensamento contextual pedindo exemplos de situações reais.',
          icon: '💡',
        },
        {
          id: 'fr-clarify',
          intent: 'Ou tirar uma dúvida específica:',
          category: 'perguntar',
          template: '« Quelle est la nuance exacte entre [terme A] et [terme B] ? »',
          starterText: 'Quelle est la différence exacte entre ce terme et ',
          translation: 'Qual é a diferença exata entre esse termo e...?',
          pedagogicalNote: 'Desenvolve precisão vocabular ao explorar nuances semânticas.',
          icon: '❓',
        },
      ];
    }

    // 2. Espanhol
    if (lang.includes('espanhol') || lang.includes('spanish')) {
      return [
        {
          id: 'es-agree',
          intent: 'Você pode responder assim (concordando):',
          category: 'concordar',
          template: '« Sí, coincido contigo porque en mi caso [tu experiencia]... »',
          starterText: 'Sí, coincido totalmente contigo porque ',
          translation: 'Sim, concordo totalmente com você porque...',
          pedagogicalNote: 'Ensina o verbo "coincidir" e a conectar com experiências pessoais.',
          icon: '👍',
        },
        {
          id: 'es-opinion',
          intent: 'Ou responder assado (trazendo outro ponto de vista):',
          category: 'contrapor',
          template: '« Desde mi punto de vista, suele ser mejor [tu propuesta]... »',
          starterText: 'Desde mi punto de vista, considero que ',
          translation: 'Do meu ponto de vista, considero que...',
          pedagogicalNote: 'Ensina expressões idiomáticas para expor opiniões com diplomacia.',
          icon: '💭',
        },
        {
          id: 'es-example',
          intent: 'Ou pedir um exemplo prático:',
          category: 'exemplo',
          template: '« ¿Podrías darme un ejemplo real de cómo usarlo al [situación]? »',
          starterText: '¿Podrías darme un ejemplo real de cómo usar esto al ',
          translation: 'Poderia me dar um exemplo real de como usar isso ao...?',
          pedagogicalNote: 'Estimula a transferência de conhecimento para contextos cotidianos.',
          icon: '💡',
        },
        {
          id: 'es-clarify',
          intent: 'Ou perguntar como soar natural:',
          category: 'perguntar',
          template: '« ¿Cómo sonaría esta misma frase de forma más nativa y casual? »',
          starterText: '¿Cómo diría un hispanohablante nativo esto de forma casual? ',
          translation: 'Como um nativo diria isso de forma casual?',
          pedagogicalNote: 'Ensina o contraste entre linguagem formal e expressões coloquiais.',
          icon: '❓',
        },
      ];
    }

    // 3. Alemão
    if (lang.includes('alemão') || lang.includes('german') || lang.includes('alemao')) {
      return [
        {
          id: 'de-agree',
          intent: 'Você pode responder assim (concordando):',
          category: 'concordar',
          template: '« Ja, ich stimme vollkommen zu, weil [Begründung mit Verb am Ende]... »',
          starterText: 'Ja, ich stimme vollkommen zu, weil ',
          translation: 'Sim, concordo plenamente porque...',
          pedagogicalNote: 'Treina a estrutura com a conjunção subordinada "weil" e verbo no final.',
          icon: '👍',
        },
        {
          id: 'de-opinion',
          intent: 'Ou responder assado (opinião própria):',
          category: 'opinar',
          template: '« Meiner Ansicht nach ist es sinnvoller, wenn [deine Ansicht]... »',
          starterText: 'Meiner Ansicht nach ist es besser, wenn ',
          translation: 'Na minha visão é melhor quando...',
          pedagogicalNote: 'Ensina a introduzir avaliações com "Meiner Ansicht nach".',
          icon: '💭',
        },
        {
          id: 'de-example',
          intent: 'Ou pedir um exemplo:',
          category: 'exemplo',
          template: '« Könntest du mir bitte einen Beispielsatz im Alltag zeigen? »',
          starterText: 'Könntest du mir bitte einen Beispielsatz für ',
          translation: 'Poderia me mostrar uma frase de exemplo no dia a dia?',
          pedagogicalNote: 'Estimula a prática de cortesia formal com o subjuntivo "Könntest du".',
          icon: '💡',
        },
        {
          id: 'de-clarify',
          intent: 'Ou tirar uma dúvida gramatical:',
          category: 'perguntar',
          template: '« Welcher Fall (Dativ/Akkusativ) wird hier verlangt? »',
          starterText: 'Welche Präposition oder welcher Kasus passt hier am besten zu ',
          translation: 'Qual preposição ou caso se encaixa melhor aqui com...?',
          pedagogicalNote: 'Auxilia na fixação da regência de casos (Nominativ, Akkusativ, Dativ).',
          icon: '❓',
        },
      ];
    }

    // 4. Italiano
    if (lang.includes('italiano') || lang.includes('italian')) {
      return [
        {
          id: 'it-agree',
          intent: 'Você pode responder assim (concordando):',
          category: 'concordar',
          template: '« Sono pienamente d’accordo con te, soprattutto perché [motivo]... »',
          starterText: "Sono pienamente d'accordo con te, soprattutto perché ",
          translation: 'Concordo plenamente com você, especialmente porque...',
          pedagogicalNote: 'Ensina a reforçar pontos de vista com o advérbio "soprattutto".',
          icon: '👍',
        },
        {
          id: 'it-opinion',
          intent: 'Ou responder assado (opinião alternativa):',
          category: 'opinar',
          template: '« Dal mio punto di vista, preferisco invece [la tua opzione]... »',
          starterText: 'Dal mio punto di vista, preferisco invece ',
          translation: 'Do meu ponto de vista, prefiro em vez disso...',
          pedagogicalNote: 'Ensina o uso contrastivo de "invece" para contrapor opções.',
          icon: '💭',
        },
        {
          id: 'it-example',
          intent: 'Ou pedir um diálogo prático:',
          category: 'exemplo',
          template: '« Mi faresti un esempio di conversazione reale usando [parola]? »',
          starterText: 'Mi faresti un esempio pratico in un contesto informale di ',
          translation: 'Poderia me dar um exemplo prático num contexto informal?',
          pedagogicalNote: 'Estimula a absorção de linguagem viva em interações autênticas.',
          icon: '💡',
        },
        {
          id: 'it-clarify',
          intent: 'Ou perguntar sobre nuances:',
          category: 'perguntar',
          template: '« Qual è la differenza di registro tra queste due espressioni? »',
          starterText: 'Qual è la differenza di registro tra questa espressione e ',
          translation: 'Qual a diferença de registro entre essa expressão e...?',
          pedagogicalNote: 'Ajuda a diferenciar registros formais de informais.',
          icon: '❓',
        },
      ];
    }

    // 5. Padrão: Inglês
    // Se o tópico ou mensagem falar de passado/hábito:
    if (cleanTutorText.includes('yesterday') || cleanTutorText.includes('used to') || cleanTutorText.includes('past') || currentTopic.toLowerCase().includes('past')) {
      return [
        {
          id: 'en-past-habit',
          intent: 'Você pode responder assim (falando de hábitos passados):',
          category: 'opinar',
          template: '“I used to [ação no infinitivo], but now I usually [rotina atual]...”',
          starterText: 'I used to ',
          translation: 'Eu costumava [fazer algo], mas agora geralmente...',
          pedagogicalNote: 'Ensina a contrastar o passado com "used to" e o presente com "now I usually".',
          icon: '⏳',
        },
        {
          id: 'en-past-event',
          intent: 'Ou responder assado (narrando uma situação que aconteceu):',
          category: 'concordar',
          template: '“A few days ago, I had a situation where [descreva o evento]...”',
          starterText: 'A few days ago, I experienced a situation where ',
          translation: 'Alguns dias atrás, passei por uma situação em que...',
          pedagogicalNote: 'Ensina time markers no passado ("a few days ago") com narrative tenses.',
          icon: '📖',
        },
        {
          id: 'en-past-clarify',
          intent: 'Ou tirar uma dúvida sobre Simple Past x Present Perfect:',
          category: 'perguntar',
          template: '“When should I use Simple Past instead of Present Perfect in this case?”',
          starterText: 'Could you explain when to choose Simple Past over Present Perfect here? ',
          translation: 'Poderia explicar quando escolher Simple Past em vez de Present Perfect aqui?',
          pedagogicalNote: 'Ajuda a dominar a distinção entre tempo definido vs. experiência de vida.',
          icon: '❓',
        },
        {
          id: 'en-past-example',
          intent: 'Ou pedir outro exemplo cotidiano:',
          category: 'exemplo',
          template: '“Could you give me another realistic sentence with irregular past verbs?”',
          starterText: 'Could you give me another real-life example showing how to use ',
          translation: 'Poderia me dar outro exemplo real mostrando como usar...?',
          pedagogicalNote: 'Reforça a memorização de verbos irregulares no contexto de conversação.',
          icon: '💡',
        },
      ];
    }

    // Padrão Geral Inglês
    return [
      {
        id: 'en-agree',
        intent: 'Você pode responder assim (concordando e justificando):',
        category: 'concordar',
        template: '“I definitely agree with this perspective because [complete com seu motivo]...”',
        starterText: 'I definitely agree with this perspective because ',
        translation: 'Concordo definitivamente com essa perspectiva porque...',
        pedagogicalNote: 'Ensina a usar advérbios de reforço ("definitely") e conectivos causais ("because").',
        icon: '👍',
      },
      {
        id: 'en-opinion',
        intent: 'Ou responder assado (expressando seu ponto de vista pessoal):',
        category: 'opinar',
        template: '“From my personal standpoint, I tend to prefer [sua preferência]...”',
        starterText: 'From my personal standpoint, I tend to prefer ',
        translation: 'Do meu ponto de vista pessoal, costumo preferir...',
        pedagogicalNote: 'Ensina hedging / modulação de opinião educada no idioma formal e profissional.',
        icon: '💭',
      },
      {
        id: 'en-example',
        intent: 'Ou pedir uma aplicação prática no dia a dia:',
        category: 'exemplo',
        template: '“Could you provide a real-world scenario where natives use this structure?”',
        starterText: 'Could you provide a real-world scenario where natives use ',
        translation: 'Poderia fornecer um cenário real onde nativos usam essa estrutura?',
        pedagogicalNote: 'Conecta o aprendizado gramatical abstrato com a prática conversacional real.',
        icon: '💡',
      },
      {
        id: 'en-clarify',
        intent: 'Ou perguntar como soar mais natural e fluente:',
        category: 'perguntar',
        template: '“How could I rephrase my idea to sound more fluent and natural?”',
        starterText: 'How could a native speaker phrase this more naturally? ',
        translation: 'Como um falante nativo formularia isso com mais naturalidade?',
        pedagogicalNote: 'Estimula a reflexão sobre conectores, collocations e naturalidade.',
        icon: '❓',
      },
    ];
  }
}
