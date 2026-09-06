import express from 'express';
import { Type } from '@google/genai';
import type { GoogleGenAI } from '@google/genai';
import { generateWithFallback } from '../ai/generateWithFallback';

export function createOnboardingRouter(
  getClient: () => GoogleGenAI | null,
  timeoutMs?: number
): express.Router {
  const router = express.Router();

  // NOVO: Assistente de Configuração Inicial (Onboarding) - Gera Plano Personalizado e Primeiros Conteúdos
  router.post('/', async (req, res) => {
    try {
      const {
        idioma_alvo = 'Inglês',
        nivel_atual = 'B1',
        motivo_principal = 'Trabalho & Carreira',
        motivo_detalhado = '',
        interesses = ['Tecnologia & IA', 'Conversação Cotidiana'],
        tempo_diario_minutos = 30,
        estilo_aprendizado = 'conversacao_voz',
        horario_preferido = '19:00',
      } = req.body;

      const client = getClient();

      if (!client) {
        return res.json({
          plano: generateLocalOnboardingPlan(
            idioma_alvo,
            nivel_atual,
            motivo_principal,
            motivo_detalhado,
            interesses,
            tempo_diario_minutos,
            estilo_aprendizado
          ),
        });
      }

      const prompt = `
Você é o Arquiteto Pedagógico Chefe e Tutor de Línguas de Inteligência Artificial para estudantes que aprendem ${idioma_alvo}.
Sua missão é criar o PRIMEIRO PLANO DE ESTUDOS ULTRA PERSONALIZADO e GERAR OS PRIMEIROS CONTEÚDOS DE ALTO VALOR IMEDIATO com base no perfil do estudante.

Perfil do Estudante:
- Idioma Alvo de Estudo: "${idioma_alvo}"
- Nível Atual Autodeclarado (CEFR): "${nivel_atual}"
- Motivo Principal / Objetivo: "${motivo_principal}"
- Detalhes Específicos do Aluno: "${motivo_detalhado || 'Foco em destravar conversação e vocabulário relevante'}"
- Interesses & Afinidades: ${JSON.stringify(interesses)}
- Tempo Disponível Diário: ${tempo_diario_minutos} minutos/dia
- Estilo Preferido de Aprendizado: "${estilo_aprendizado}"

Gere uma resposta JSON estruturada estritamente de acordo com o schema com:
1. "titulo_plano": Nome empolgante, profissional e focado do plano (ex: "Trilha Imersiva: Inglês para Tecnologia & Reuniões Globais").
2. "descricao_plano": Breve resumo explicando a proposta pedagógica e como o aluno atingirá o objetivo no tempo estipulado.
3. "topico_inicial_recomendado": Nome do primeiro tópico de conversação que o Tutor de Chat deve ativar (ex: "${idioma_alvo}: Daily Standups & Negociações de TI" ou "${idioma_alvo}: Situações em Restaurantes e Viagens").
4. "mensagem_boas_vindas_tutor": Uma mensagem calorosa de boas-vindas do tutor, iniciando no idioma alvo (${idioma_alvo}) e conectando o plano aos objetivos do aluno, já propondo a primeira pergunta de abertura prática no idioma alvo (${idioma_alvo}) para começar a conversa imediatamente.
5. "estrategia_pedagogica": Explicação da abordagem (ex: repetição espaçada, foco em collocations e connected speech sem fixação excessiva em decoreba gramatical).
6. "cronograma_semanal": Array com 7 dias da semana (Segunda a Domingo), especificando:
   - "dia_semana": Nome do dia
   - "foco": Tópico do dia
   - "duracao_minutos": ${tempo_diario_minutos}
   - "tipo_atividade": "chat" | "flashcards" | "duel" | "materials"
   - "descricao_pratica": Instrução clara de 1 frase do que fazer
7. "nos_iniciais_grafo": Array com 4 a 6 nós essenciais para inicializar o Grafo de Memória do aluno:
   - "tipo": "vocabulario" | "expressao_idiomatica" | "falso_amigo" | "gramatica"
   - "titulo": Termo ou estrutura
   - "descricao": Explicação prática em Português
   - "dominio_estimado": 35 a 55
   - "dificuldade": 1 a 4
   - "pronuncia_ipa": Transcrição fonética IPA precisa
   - "traducao": Tradução para o Português
   - "exemplo_uso": Frase de exemplo autêntica no idioma alvo
8. "primeiro_material_estudo": Kit de estudos de aula inicial com:
   - "titulo": Título do kit
   - "resumo": Resumo didático
   - "vocabulario": 4 a 6 termos essenciais com termo, pronuncia_ipa, traducao, classe_gramatical, exemplo e traducao_exemplo
   - "gramatica": 1 a 2 padrões gramaticais ou dicas de colocação com dica_para_brasileiros
   - "dialogo_pratica": Diálogo de 4 a 6 falas entre personagens aplicando os termos
   - "questoes_compreensao": 2 questões interativas com opções, resposta_correta e explicação
   - "flashcards": 3 a 5 flashcards com frente, verso e dica
   - "dicas_culturais_e_pronuncia": 2 dicas práticas
   - "conteudo_markdown": Guia completo formatado em Markdown
9. "dicas_personalizadas": 2 a 3 dicas pontuais de produtividade linguística ajustadas ao perfil.
`;

      const response = await generateWithFallback({
        client,
        params: {
          model: 'gemini-3.7-flash',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                titulo_plano: { type: Type.STRING },
                descricao_plano: { type: Type.STRING },
                topico_inicial_recomendado: { type: Type.STRING },
                mensagem_boas_vindas_tutor: { type: Type.STRING },
                estrategia_pedagogica: { type: Type.STRING },
                cronograma_semanal: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      dia_semana: { type: Type.STRING },
                      foco: { type: Type.STRING },
                      duracao_minutos: { type: Type.NUMBER },
                      tipo_atividade: {
                        type: Type.STRING,
                        enum: ['chat', 'flashcards', 'duel', 'materials'],
                      },
                      descricao_pratica: { type: Type.STRING },
                    },
                    required: ['dia_semana', 'foco', 'duracao_minutos', 'tipo_atividade', 'descricao_pratica'],
                  },
                },
                nos_iniciais_grafo: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      tipo: {
                        type: Type.STRING,
                        enum: ['vocabulario', 'expressao_idiomatica', 'falso_amigo', 'gramatica'],
                      },
                      titulo: { type: Type.STRING },
                      descricao: { type: Type.STRING },
                      dominio_estimado: { type: Type.NUMBER },
                      dificuldade: { type: Type.NUMBER },
                      pronuncia_ipa: { type: Type.STRING },
                      traducao: { type: Type.STRING },
                      exemplo_uso: { type: Type.STRING },
                    },
                    required: ['tipo', 'titulo', 'descricao', 'traducao', 'exemplo_uso'],
                  },
                },
                primeiro_material_estudo: {
                  type: Type.OBJECT,
                  properties: {
                    titulo: { type: Type.STRING },
                    resumo: { type: Type.STRING },
                    vocabulario: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          termo: { type: Type.STRING },
                          pronuncia_ipa: { type: Type.STRING },
                          traducao: { type: Type.STRING },
                          classe_gramatical: { type: Type.STRING },
                          exemplo: { type: Type.STRING },
                          traducao_exemplo: { type: Type.STRING },
                        },
                        required: ['termo', 'traducao', 'exemplo'],
                      },
                    },
                    gramatica: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          topico: { type: Type.STRING },
                          explicacao: { type: Type.STRING },
                          exemplos: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          dica_para_brasileiros: { type: Type.STRING },
                        },
                        required: ['topico', 'explicacao', 'exemplos'],
                      },
                    },
                    dialogo_pratica: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          personagem: { type: Type.STRING },
                          fala: { type: Type.STRING },
                          traducao: { type: Type.STRING },
                        },
                        required: ['personagem', 'fala'],
                      },
                    },
                    questoes_compreensao: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          pergunta: { type: Type.STRING },
                          opcoes: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          resposta_correta: { type: Type.STRING },
                          explicacao: { type: Type.STRING },
                        },
                        required: ['pergunta', 'resposta_correta', 'explicacao'],
                      },
                    },
                    flashcards: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          frente: { type: Type.STRING },
                          verso: { type: Type.STRING },
                          dica: { type: Type.STRING },
                        },
                        required: ['frente', 'verso'],
                      },
                    },
                    dicas_culturais_e_pronuncia: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    conteudo_markdown: { type: Type.STRING },
                  },
                  required: ['titulo', 'resumo', 'vocabulario', 'gramatica', 'dialogo_pratica', 'conteudo_markdown'],
                },
                dicas_personalizadas: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
              required: [
                'titulo_plano',
                'descricao_plano',
                'topico_inicial_recomendado',
                'mensagem_boas_vindas_tutor',
                'estrategia_pedagogica',
                'cronograma_semanal',
                'nos_iniciais_grafo',
                'primeiro_material_estudo',
                'dicas_personalizadas',
              ],
            },
          },
        },
        route: 'onboarding',
        // Timeout por tentativa configurável (GEMINI_TIMEOUT_MS via appEnv).
        timeoutMs: timeoutMs ?? 60_000,
      });

      const parsed = JSON.parse(response.text || '{}');
      const planId = `plan-${Date.now()}`;

      const generatedPlan = {
        id: planId,
        titulo_plano: parsed.titulo_plano || `Plano de ${idioma_alvo} Personalizado`,
        descricao_plano: parsed.descricao_plano || 'Plano customizado calibrado pelo assistente de configuração com inteligência artificial.',
        idioma: idioma_alvo,
        nivel_cefr: nivel_atual,
        meta_diaria_minutos: tempo_diario_minutos,
        motivo_principal: motivo_principal,
        interesses_principais: interesses,
        topico_inicial_recomendado: parsed.topico_inicial_recomendado || `${idioma_alvo}: ${interesses[0] || 'Conversação Essencial'}`,
        mensagem_boas_vindas_tutor: parsed.mensagem_boas_vindas_tutor || `Olá! Seu plano para ${idioma_alvo} está pronto. Vamos começar?`,
        estrategia_pedagogica: parsed.estrategia_pedagogica || 'Imersão conversacional adaptativa combinada com repetição espaçada no grafo.',
        cronograma_semanal: parsed.cronograma_semanal || [],
        nos_iniciais_grafo: (parsed.nos_iniciais_grafo || []).map((node: any, idx: number) => ({
          ...node,
          id: `node-onboarding-${Date.now()}-${idx}`,
          idioma: idioma_alvo,
          dominio_estimado: node.dominio_estimado || 40,
          dificuldade: node.dificuldade || 2,
          frequencia_erro: 0,
          ultima_revisao: new Date().toISOString(),
          proxima_revisao: new Date(Date.now() + 86400000).toISOString(),
          criado_em: new Date().toISOString(),
          atualizado_em: new Date().toISOString(),
          evidencias: ['Configuração de Perfil Inicial'],
        })),
        primeiro_material_estudo: {
          id: `mat-onboarding-${Date.now()}`,
          titulo: parsed.primeiro_material_estudo?.titulo || `Kit Inicial: ${idioma_alvo} Prático`,
          tipo_fonte: 'texto' as const,
          fonte_original: 'Assistente de Configuração Personalizado',
          idioma_alvo: idioma_alvo,
          nivel_cefr: nivel_atual,
          resumo: parsed.primeiro_material_estudo?.resumo || 'Material introdutório focado nos seus interesses e objetivos.',
          vocabulario: parsed.primeiro_material_estudo?.vocabulario || [],
          gramatica: parsed.primeiro_material_estudo?.gramatica || [],
          dialogo_pratica: parsed.primeiro_material_estudo?.dialogo_pratica || [],
          questoes_compreensao: parsed.primeiro_material_estudo?.questoes_compreensao || [],
          flashcards: parsed.primeiro_material_estudo?.flashcards || [],
          dicas_culturais_e_pronuncia: parsed.primeiro_material_estudo?.dicas_culturais_e_pronuncia || [],
          conteudo_markdown: parsed.primeiro_material_estudo?.conteudo_markdown || `# ${parsed.titulo_plano}\n\nMaterial preparado para você.`,
          criado_em: new Date().toISOString(),
          adicionado_ao_grafo: true,
        },
        dicas_personalizadas: parsed.dicas_personalizadas || [],
        criado_em: new Date().toISOString(),
      };

      return res.json({ plano: generatedPlan });
    } catch (err: any) {
      console.warn('Erro ao gerar plano no onboarding via Gemini:', err?.message || err);
      const fallback = generateLocalOnboardingPlan(
        req.body?.idioma_alvo || 'Inglês',
        req.body?.nivel_atual || 'B1',
        req.body?.motivo_principal || 'Trabalho & Carreira',
        req.body?.motivo_detalhado || '',
        req.body?.interesses || ['Tecnologia & IA', 'Conversação'],
        req.body?.tempo_diario_minutos || 30,
        req.body?.estilo_aprendizado || 'conversacao_voz'
      );
      return res.json({ plano: fallback });
    }
  });

  return router;
}

function generateLocalOnboardingPlan(
  idioma: string,
  nivel: string,
  motivo: string,
  motivoDetalhado: string,
  interesses: string[],
  tempoDiario: number,
  estilo: string
) {
  const planId = `plan-local-${Date.now()}`;
  const firstInterest = interesses[0] || 'Conversação Prática';
  const secondInterest = interesses[1] || 'Vocabulário Ativo';

  const vocabMap: Record<string, any[]> = {
    'Inglês': [
      {
        termo: 'Touch base',
        pronuncia_ipa: '/tʌtʃ beɪs/',
        traducao: 'Fazer um contato rápido / Alinhar pontos',
        classe_gramatical: 'Expressão idiomática',
        exemplo: "Let's touch base tomorrow morning before the sprint planning.",
        traducao_exemplo: 'Vamos nos alinhar amanhã de manhã antes do planejamento da sprint.',
      },
      {
        termo: 'Actually',
        pronuncia_ipa: '/ˈæk.tʃu.ə.li/',
        traducao: 'Na verdade, realmente',
        classe_gramatical: 'Advérbio (Atenção a Falso Cognato)',
        exemplo: 'Actually, the requirements changed yesterday.',
        traducao_exemplo: 'Na verdade, os requisitos mudaram ontem.',
      },
      {
        termo: 'Wrap up',
        pronuncia_ipa: '/ræp ʌp/',
        traducao: 'Finalizar / Concluir',
        classe_gramatical: 'Phrasal Verb',
        exemplo: 'We need to wrap up this discussion in five minutes.',
        traducao_exemplo: 'Precisamos concluir esta discussão em cinco minutos.',
      },
      {
        termo: 'Insights',
        pronuncia_ipa: '/ˈɪn.saɪts/',
        traducao: 'Percepções valiosas / Ideias esclarecedoras',
        classe_gramatical: 'Substantivo plural',
        exemplo: 'Thank you for sharing your valuable insights on the project.',
        traducao_exemplo: 'Obrigado por compartilhar suas valiosas percepções sobre o projeto.',
      },
    ],
    'Espanhol': [
      {
        termo: 'Ponerse al día',
        pronuncia_ipa: '/poˈneɾ.se al ˈdi.a/',
        traducao: 'Colocar o papo em dia / Atualizar-se',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Vamos a tomar un café para ponernos al día sobre el trabajo.',
        traducao_exemplo: 'Vamos tomar um café para nos atualizarmos sobre o trabalho.',
      },
      {
        termo: 'Actualmente',
        pronuncia_ipa: '/ak.twa.lˈmen.te/',
        traducao: 'Atualmente, hoje em dia',
        classe_gramatical: 'Advérbio',
        exemplo: 'Actualmente estoy liderando un nuevo proyecto de tecnología.',
        traducao_exemplo: 'Atualmente estou liderando um novo projeto de tecnologia.',
      },
      {
        termo: 'Tener en cuenta',
        pronuncia_ipa: '/teˈneɾ en ˈkwen.ta/',
        traducao: 'Levar em consideração / Ter em mente',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Hay que tener en cuenta los plazos de entrega.',
        traducao_exemplo: 'É preciso levar em consideração os prazos de entrega.',
      },
    ],
    'Francês': [
      {
        termo: 'Faire le point',
        pronuncia_ipa: '/fɛʁ lə pwɛ̃/',
        traducao: 'Fazer um balanço / Alinhar a situação',
        classe_gramatical: 'Expressão idiomática',
        exemplo: 'Faisons le point sur les priorités de la semaine.',
        traducao_exemplo: 'Vamos fazer um balanço sobre as prioridades da semana.',
      },
      {
        termo: 'En fait',
        pronuncia_ipa: '/ɑ̃ fɛt/',
        traducao: 'Na verdade, de fato',
        classe_gramatical: 'Expressão / Advérbio',
        exemplo: 'En fait, je suis tout à fait d’accord avec cette approche.',
        traducao_exemplo: 'Na verdade, concordo plenamente com essa abordagem.',
      },
    ],
  };

  const vocabList = vocabMap[idioma] || vocabMap['Inglês'];

  const initialNodes = vocabList.map((v, idx) => ({
    id: `node-onb-${Date.now()}-${idx}`,
    tipo: (v.classe_gramatical.includes('Falso') ? 'falso_amigo' : 'vocabulario') as any,
    titulo: v.termo,
    descricao: v.traducao,
    dominio_estimado: 45,
    dificuldade: 2,
    frequencia_erro: 0,
    ultima_revisao: new Date().toISOString(),
    proxima_revisao: new Date(Date.now() + 86400000).toISOString(),
    idioma,
    pronuncia_ipa: v.pronuncia_ipa,
    traducao: v.traducao,
    exemplo_uso: v.exemplo,
    evidencias: ['Plano Inicial do Assistente'],
    criado_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  }));

  const recommendedTopic = `${idioma}: ${motivo} & ${firstInterest}`;

  return {
    id: planId,
    titulo_plano: `Trilha Sob Medida: ${idioma} para ${motivo}`,
    descricao_plano: `Plano estruturado de ${tempoDiario} minutos diários focado em ${firstInterest} e ${secondInterest}, calibrado para o nível ${nivel}.`,
    idioma,
    nivel_cefr: nivel,
    meta_diaria_minutos: tempoDiario,
    motivo_principal: motivo,
    interesses_principais: interesses,
    topico_inicial_recomendado: recommendedTopic,
    mensagem_boas_vindas_tutor: `Olá! Seu plano de ${idioma} foi montado especialmente para seus objetivos de "${motivo}". Preparei um ambiente focado nos seus interesses em ${firstInterest}. Vamos começar com um bate-papo leve e prático?`,
    estrategia_pedagogica: 'Imersão contextual com foco em vocabulário ativo, repetição espaçada no grafo relacional e conversação sem medo de errar.',
    cronograma_semanal: [
      {
        dia_semana: 'Segunda-feira',
        foco: `Vocabulário Essencial de ${firstInterest}`,
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: `Praticar termos e expressões chave de ${firstInterest} no chat conversacional.`,
      },
      {
        dia_semana: 'Terça-feira',
        foco: 'Repetição Espaçada & Flashcards SM-2',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'flashcards' as const,
        descricao_pratica: 'Revisar os novos cartões gerados e consolidar a retenção.',
      },
      {
        dia_semana: 'Quarta-feira',
        foco: `Diálogo Situacional: ${secondInterest}`,
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: 'Simular uma situação real de conversação e foco em pronúncia natural.',
      },
      {
        dia_semana: 'Quinta-feira',
        foco: 'Duelo de Vocabulário Rápido',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'duel' as const,
        descricao_pratica: 'Treinar reflexo rápido e precisão de termos sob pressão.',
      },
      {
        dia_semana: 'Sexta-feira',
        foco: 'Kit de Estudos & Leitura Guiada',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'materials' as const,
        descricao_pratica: 'Explorar o kit de estudos gerado com áudio IPA e questões.',
      },
      {
        dia_semana: 'Sábado',
        foco: 'Conversação Livre & Feedback de Pronúncia',
        duracao_minutos: tempoDiario,
        tipo_atividade: 'chat' as const,
        descricao_pratica: 'Bate-papo por voz em tempo real para consolidar a semana.',
      },
      {
        dia_semana: 'Domingo',
        foco: 'Revisão do Grafo de Memória & Descanso Ativo',
        duracao_minutos: Math.max(10, Math.round(tempoDiario * 0.5)),
        tipo_atividade: 'flashcards' as const,
        descricao_pratica: 'Revisão leve de 10 minutos para manter o streak ativo.',
      },
    ],
    nos_iniciais_grafo: initialNodes,
    primeiro_material_estudo: {
      id: `mat-onboarding-${Date.now()}`,
      titulo: `${idioma}: Guia Prático para ${motivo}`,
      tipo_fonte: 'texto' as const,
      fonte_original: 'Assistente de Configuração Personalizado',
      idioma_alvo: idioma,
      nivel_cefr: nivel,
      resumo: `Kit fundamental com vocabulário prioritário, padrão de diálogo e flashcards calibrados para quem estuda para ${motivo}.`,
      vocabulario: vocabList,
      gramatica: [
        {
          topico: 'Conectivos e Fluência Conversacional',
          explicacao: 'Use conectivos naturais para estruturar suas ideias sem parecer engessado.',
          exemplos: [
            'On the other hand, we should consider alternative options.',
            'As far as I know, the team is already working on it.',
          ],
          dica_para_brasileiros: 'Evite pausas longas com "ééé...", use fillers naturais como "Well...", "You see...", "Actually..."',
        },
      ],
      dialogo_pratica: [
        {
          personagem: 'Alex',
          fala: 'Hi there! Have you had a chance to look at the project updates?',
          traducao: 'Olá! Você teve chance de olhar as atualizações do projeto?',
        },
        {
          personagem: 'Você',
          fala: 'Actually, yes! I reviewed them this morning and have some good insights.',
          traducao: 'Na verdade, sim! Eu revisei hoje de manhã e tenho algumas boas percepções.',
        },
      ],
      questoes_compreensao: [
        {
          pergunta: `Qual a melhor forma de usar "Actually" em uma reunião?`,
          opcoes: [
            'Como tradução de atualmente para indicar o presente momento',
            'Para esclarecer um ponto com cordialidade ("na verdade / de fato")',
            'Como substituto de "never"',
          ],
          resposta_correta: 'Para esclarecer um ponto com cordialidade ("na verdade / de fato")',
          explicacao: 'Actually é um falso cognato para brasileiros; significa "na verdade" e não "atualmente".',
        },
      ],
      flashcards: vocabList.map((v) => ({
        frente: v.termo,
        verso: `${v.traducao}\nEx: ${v.exemplo}`,
        dica: v.pronuncia_ipa || 'Pratique em voz alta',
      })),
      dicas_culturais_e_pronuncia: [
        'Pratique os termos novos em frases completas em vez de listas isoladas.',
        'Grave sua voz e compare a entonação no espectro de áudio do chat.',
      ],
      conteudo_markdown: `# ${idioma}: Guia Prático para ${motivo}\n\nBem-vindo ao seu plano de estudos! Explore este material para acelerar sua fluência.`,
      criado_em: new Date().toISOString(),
      adicionado_ao_grafo: true,
    },
    dicas_personalizadas: [
      `Ajuste sua rotina para estudar ${tempoDiario} min no mesmo horário todo dia.`,
      'Intercale momentos de fala por voz com momentos de revisão de flashcards no app.',
      'Sempre que o tutor apontar uma correção, repita a frase corrigida em voz alta.',
    ],
    criado_em: new Date().toISOString(),
  };
}
