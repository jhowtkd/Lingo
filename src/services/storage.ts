import {
  GraphNode,
  GraphRelation,
  PedagogicalCorrection,
  ChatMessage,
  ChatConversation,
  UserStats,
  Achievement,
  StudySession,
  StudyMaterialItem,
  NotebookLMSyncDoc,
  PracticeReminder,
  UserProfile,
  SharedKnowledgePack,
  GeneratedStudyPlan,
  OnboardingAnswers,
  CEFRLevel,
} from '../types';
import { ACHIEVEMENT_TEMPLATES } from './achievementTemplates';
import {
  syncPersonalKnowledgeToCloud,
  fetchPersonalKnowledgeFromCloud,
  updateUserStatsSummary,
} from './firebase';
import { PLAN_NODE_EVIDENCE } from './progressMetrics';
import {
  SYNC_META_KEY,
  STORAGE_LIMITS,
  SyncCollection,
  clearStorageCache,
  readJsonCached,
  readSyncMeta,
  shouldApplyCloudCollection,
  trimConversations,
  writeJsonCached,
  writeSyncMeta,
} from './storageCore';

const STORAGE_KEYS = {
  NODES: 'tutor_graph_nodes_v1',
  RELATIONS: 'tutor_graph_relations_v1',
  CORRECTIONS: 'tutor_corrections_v1',
  CHATS: 'tutor_chat_history_v1',
  CONVERSATIONS: 'tutor_conversations_v2',
  ACTIVE_CONVERSATION_ID: 'tutor_active_conv_id_v2',
  STATS: 'tutor_user_stats_v1',
  ACHIEVEMENTS: 'tutor_achievements_v1',
  SESSIONS: 'tutor_sessions_v1',
  MATERIALS: 'tutor_study_materials_v1',
  NOTEBOOKLM: 'tutor_notebooklm_docs_v1',
  REMINDERS: 'tutor_practice_reminders_v1',
  SETTINGS: 'tutor_settings_v1',
  ONBOARDING_PLAN: 'tutor_onboarding_plan_v1',
  ONBOARDING_COMPLETED: 'tutor_onboarding_completed_v1',
};

// Conquistas do sistema: seed usa a fonte única em achievementTemplates.ts
export const DEFAULT_ACHIEVEMENTS: Achievement[] = ACHIEVEMENT_TEMPLATES;

// Dados Iniciais de Materiais de Estudo para o MVP
export const SEED_MATERIALS: StudyMaterialItem[] = [
  {
    id: 'mat-seed-1',
    titulo: 'How to Sound Natural: Connected Speech in Everyday English',
    tipo_fonte: 'youtube',
    fonte_original: 'https://www.youtube.com/watch?v=kpv2B883bH4',
    youtube_video_id: 'kpv2B883bH4',
    idioma_alvo: 'Inglês',
    nivel_cefr: 'B2',
    resumo:
      'Guia prático para destravar a compreensão auditiva e fala fluente através de connected speech (ligação de consoante com vogal, elisão de sons e redução de preposições).',
    vocabulario: [
      {
        termo: 'Connected speech',
        pronuncia_ipa: '/kəˈnɛktɪd spiːtʃ/',
        traducao: 'Fala encadeada / contínua',
        classe_gramatical: 'Substantivo',
        exemplo: 'Connected speech makes native speakers sound so fast.',
        traducao_exemplo: 'A fala encadeada faz os falantes nativos parecerem tão rápidos.',
        nivel: 'B2',
      },
      {
        termo: 'Link up',
        pronuncia_ipa: '/lɪŋk ʌp/',
        traducao: 'Ligar / Conectar sons',
        classe_gramatical: 'Phrasal Verb',
        exemplo: 'When a word ends in a consonant and the next begins with a vowel, link them up.',
        traducao_exemplo: 'Quando uma palavra termina em consoante e a próxima começa com vogal, ligue-as.',
        nivel: 'B1',
      },
      {
        termo: 'Nuance',
        pronuncia_ipa: '/ˈnjuː.ɑːns/',
        traducao: 'Nuance / Detalhe sutil',
        classe_gramatical: 'Substantivo',
        exemplo: 'Tone adds emotional nuance to simple sentences.',
        traducao_exemplo: 'O tom adiciona nuances emocionais a frases simples.',
        nivel: 'B2',
      },
      {
        termo: 'Get used to',
        pronuncia_ipa: '/ɡɛt juːst tuː/',
        traducao: 'Acostumar-se com',
        classe_gramatical: 'Expressão Verbal',
        exemplo: 'You will quickly get used to the natural rhythm of the language.',
        traducao_exemplo: 'Você vai se acostumar rapidamente com o ritmo natural do idioma.',
        nivel: 'B1',
      },
    ],
    gramatica: [
      {
        topico: 'Linking Consonant to Vowel (C + V)',
        explicacao:
          'Em inglês, nunca há pausa abrupta entre palavras se a primeira termina em consoante e a próxima começa em vogal. O som da consoante salta para a vogal seguinte.',
        exemplos: [
          '"Hold on" soa como /həʊl-dɒn/ (hol-don).',
          '"Turn it off" soa como /tɜː-nɪ-tɒf/ (tur-ni-toff).',
          '"An apple" soa como /ə-næp.əl/ (a-napple).',
        ],
        dica_para_brasileiros:
          'Brasileiros tendem a colocar um som de "i" no final de palavras que terminam em consoante ("holdi on"). Em vez disso, junte direto com a vogal seguinte!',
      },
      {
        topico: 'Redução de Palavras Funcionais (Weak Forms)',
        explicacao:
          'Preposições e artigos como "to", "for", "and", "of" raramente recebem tonicidade e viram som Schwa /ə/.',
        exemplos: [
          '"I want to go" soa como "I wanna go" ou /aɪ wɒnt tə ɡəʊ/.',
          '"Cup of tea" soa como "cuppa tea" /kʌp ə tiː/.',
        ],
        dica_para_brasileiros:
          'Não tente pronunciar cada palavra com força igual. A língua inglesa é "stress-timed" (baseada no ritmo das tônicas).',
      },
    ],
    dialogo_pratica: [
      {
        personagem: 'Emma',
        fala: 'Hey Lucas! Did you get a chance to review the presentation for tomorrow?',
        traducao: 'Oi Lucas! Você teve a chance de revisar a apresentação para amanhã?',
        audio_tip: '"Did you get a" soa como /dɪ-dʒu-ɡɛ-tə/.',
      },
      {
        personagem: 'Lucas',
        fala: 'Not yet, but I am going to look over it right after lunch.',
        traducao: 'Ainda não, mas vou dar uma olhada logo após o almoço.',
        audio_tip: '"look over it" liga como /lʊ-kəʊ-və-rɪt/.',
      },
      {
        personagem: 'Emma',
        fala: 'Awesome! Let me know if you run into any questions.',
        traducao: 'Maravilha! Me avise se você se deparar com alguma dúvida.',
        audio_tip: '"run into" = deparar-se/encontrar por acaso.',
      },
      {
        personagem: 'Lucas',
        fala: 'Will do! Thanks for the heads up.',
        traducao: 'Pode deixar! Obrigado pelo aviso.',
      },
    ],
    questoes_compreensao: [
      {
        pergunta: 'O que acontece quando dizemos "Turn it off" em fala conectada natural?',
        opcoes: [
          'Fazemos pausas distintas entre cada uma das palavras',
          'O "n" de turn liga no "i", e o "t" liga no "off" gerando som fluido contínuo',
          'A palavra "it" é omitida completamente',
          'Apenas a última palavra é pronunciada',
        ],
        resposta_correta: 'O "n" de turn liga no "i", e o "t" liga no "off" gerando som fluido contínuo',
        explicacao: 'A regra de Consonant-to-Vowel linking conecta consoantes finais a vogais iniciais.',
      },
      {
        pergunta: 'Qual o significado da expressão idiomática "heads up" no diálogo?',
        opcoes: [
          'Levantar a cabeça fisicamente',
          'Aviso prévio / alerta amigável',
          'Uma saudação formal para chefes',
          'Desistir de uma tarefa',
        ],
        resposta_correta: 'Aviso prévio / alerta amigável',
        explicacao: '"Give someone a heads up" é avisar alguém com antecedência sobre algo importante.',
      },
    ],
    flashcards: [
      {
        frente: 'Heads up',
        verso: 'Aviso prévio / Toque / Alerta antecipado',
        dica: 'Usado frequentemente no trabalho: "Thanks for the heads up!"',
      },
      {
        frente: 'Connected speech',
        verso: 'Fala encadeada / junção natural de palavras',
        dica: 'O segredo para entender falantes nativos em alta velocidade.',
      },
      {
        frente: 'Run into (someone / a problem)',
        verso: 'Deparar-se com / Encontrar por acaso',
        dica: 'I ran into an old friend yesterday.',
      },
      {
        frente: 'Look over (something)',
        verso: 'Passar os olhos / Examinar rapidamente',
        dica: 'Let me look over the document.',
      },
    ],
    dicas_culturais_e_pronuncia: [
      'Ritmo Inglês vs Português: O português é syllable-timed (cada sílaba tem duração similar), enquanto o inglês é stress-timed (o tempo entre as tônicas dita a velocidade).',
      'Flap T americano: No inglês dos EUA, o som de "t" ou "tt" entre duas vogais soa como o "r" brando do português em "arara" (ex: "water" -> "wa-rer", "better" -> "be-rer").',
    ],
    conteudo_markdown: `# Guia de Estudos: Connected Speech in Everyday English\n\n**Idioma**: Inglês | **Nível**: B2\n\n## 1. Princípios de Fala Conectada\nA fala natural em inglês não é uma sequência de palavras isoladas, mas uma corrente sonora contínua.\n\n## 2. Vocabulário & Phrasal Verbs\n- **Link up**: Ligar sons consonantais com vogais.\n- **Heads up**: Dica/aviso prévio.\n- **Look over**: Revisar rapidamente.\n\n## 3. Prática Conversacional\nAbra o Tutor de Línguas e pratique o diálogo simulado para treinar sua pronúncia e ritmo!`,
    criado_em: new Date().toISOString(),
    adicionado_ao_grafo: true,
  },
  {
    id: 'mat-seed-2',
    titulo: 'Actually vs Currently: Pare de Confundir em Reuniões e Conversas',
    tipo_fonte: 'youtube',
    fonte_original: 'https://www.youtube.com/watch?v=y3k1Q-P3d6w',
    youtube_video_id: 'y3k1Q-P3d6w',
    idioma_alvo: 'Inglês',
    nivel_cefr: 'B1',
    resumo:
      'Guia definitivo para eliminar o falso cognato "actually". Aprenda quando usar "currently" para expressar o presente e "actually" para retificações semânticas.',
    vocabulario: [
      {
        termo: 'Currently',
        pronuncia_ipa: '/ˈkʌr.ənt.li/',
        traducao: 'Atualmente / No momento',
        classe_gramatical: 'Advérbio de Tempo',
        exemplo: 'Currently, our team is developing a new mobile feature.',
        traducao_exemplo: 'Atualmente, nossa equipe está desenvolvendo uma nova funcionalidade mobile.',
        nivel: 'A2',
      },
      {
        termo: 'Actually',
        pronuncia_ipa: '/ˈæk.tʃu.ə.li/',
        traducao: 'Na verdade / De fato',
        classe_gramatical: 'Advérbio de Retificação',
        exemplo: 'I thought the meeting was at 3 PM, but actually it is at 4 PM.',
        traducao_exemplo: 'Eu pensei que a reunião fosse às 15h, mas na verdade é às 16h.',
        nivel: 'B1',
      },
      {
        termo: 'Pretend',
        pronuncia_ipa: '/prɪˈtɛnd/',
        traducao: 'Fingir (NÃO pretender)',
        classe_gramatical: 'Verbo',
        exemplo: 'Do not pretend to know something if you are not sure.',
        traducao_exemplo: 'Não finja saber algo se você não tiver certeza.',
        nivel: 'B1',
      },
      {
        termo: 'Intend',
        pronuncia_ipa: '/ɪnˈtɛnd/',
        traducao: 'Pretender / Ter a intenção de',
        classe_gramatical: 'Verbo',
        exemplo: 'I intend to master English fluency this year.',
        traducao_exemplo: 'Pretendo dominar a fluência em inglês este ano.',
        nivel: 'B1',
      },
    ],
    gramatica: [
      {
        topico: 'Diferenciação Semântica: Currently vs Actually',
        explicacao:
          '"Actually" é derivado de "actual" (real, factual), enquanto "Currently" deriva de "current" (atual/corrente).',
        exemplos: [
          '"Currently, I am looking for a job." (Atualmente estou procurando emprego).',
          '"Actually, I already accepted an offer!" (Na verdade, já aceitei uma proposta!).',
        ],
        dica_para_brasileiros:
          'Substitua mentalmente "Actually" por "In fact" ou "Na verdade" antes de falar para nunca mais errar.',
      },
    ],
    dialogo_pratica: [
      {
        personagem: 'Sarah',
        fala: 'Are you currently living in New York?',
        traducao: 'Você está morando atualmente em Nova York?',
      },
      {
        personagem: 'Carlos',
        fala: 'Actually, I moved to Austin last month! But I currently work for a NY company.',
        traducao: 'Na verdade, me mudei para Austin no mês passado! Mas atualmente trabalho para uma empresa de NY.',
      },
    ],
    questoes_compreensao: [
      {
        pergunta: 'Como dizer corretamente "Atualmente estou estudando programação"?',
        opcoes: [
          'Currently I am studying programming',
          'Actually I am studying programming',
          'Presently I pretend to study programming',
        ],
        resposta_correta: 'Currently I am studying programming',
        explicacao: 'Currently expressa a ação temporal em curso no presente.',
      },
    ],
    flashcards: [
      {
        frente: 'Currently',
        verso: 'Atualmente / No momento presente',
        dica: 'Currently, I am working from home.',
      },
      {
        frente: 'Actually',
        verso: 'Na verdade / De fato',
        dica: 'Actually, I prefer tea.',
      },
    ],
    dicas_culturais_e_pronuncia: [
      'Entonação de Actually: falantes nativos costumam alongar suavemente a primeira sílaba: /ˈæk.tʃu.ə.li/.',
    ],
    conteudo_markdown: `# Master Class: Actually vs Currently\n\nElimine um dos maiores vícios de tradução do português para o inglês.\n\n- **Currently**: Atualmente\n- **Actually**: Na verdade\n- **Intend**: Pretender\n- **Pretend**: Fingir`,
    criado_em: new Date().toISOString(),
    adicionado_ao_grafo: true,
  },
  {
    id: 'mat-seed-3',
    titulo: 'A Regra dos 3 Sons do "-ED" Final: Elimine o Vício do "edji"',
    tipo_fonte: 'youtube',
    fonte_original: 'https://www.youtube.com/watch?v=f20BN_fW1zM',
    youtube_video_id: 'f20BN_fW1zM',
    idioma_alvo: 'Inglês',
    nivel_cefr: 'B1',
    resumo:
      'Aprenda como pronunciar corretamente o passado de verbos regulares (/t/, /d/ e /ɪd/) sem adicionar sílabas extras artificiais.',
    vocabulario: [
      {
        termo: 'Voiced consonant',
        pronuncia_ipa: '/vɔɪst ˈkɒn.sə.nənt/',
        traducao: 'Consoante sonora (com vibração nas cordas vocais)',
        exemplo: 'Voiced sounds produce a /d/ sound for -ed (e.g. called).',
        nivel: 'B1',
      },
      {
        termo: 'Voiceless consonant',
        pronuncia_ipa: '/ˈvɔɪs.ləs ˈkɒn.sə.nənt/',
        traducao: 'Consoante surda (sem vibração nas cordas vocais)',
        exemplo: 'Voiceless sounds produce a /t/ sound for -ed (e.g. worked).',
        nivel: 'B1',
      },
    ],
    gramatica: [
      {
        topico: 'As 3 Terminações do Passado Regular',
        explicacao:
          '1) /t/ após sons surdos (k, p, s, sh, ch): worked /wɜːkt/, watched /wɒtʃt/.\n2) /d/ após sons sonoros (l, m, n, r, v): called /kɔːld/, played /pleɪd/.\n3) /ɪd/ APENAS após T ou D: wanted /ˈwɒn.tɪd/, decided /dɪˈsaɪ.dɪd/.',
        exemplos: [
          'Worked = 1 sílaba /wɜːkt/',
          'Decided = 3 sílabas /dɪ-ˈsaɪ-dɪd/',
        ],
        dica_para_brasileiros:
          'Nunca coloque a vogal "i" de apoio no final (work-edji). O som do T ou D é estalado e seco.',
      },
    ],
    dialogo_pratica: [
      {
        personagem: 'Teacher',
        fala: 'What did you do yesterday afternoon?',
        traducao: 'O que você fez ontem à tarde?',
      },
      {
        personagem: 'Student',
        fala: 'I worked on my project and called my manager.',
        traducao: 'Eu trabalhei no meu projeto e liguei para o meu gerente.',
        audio_tip: 'worked -> /wɜːkt/, called -> /kɔːld/.',
      },
    ],
    questoes_compreensao: [
      {
        pergunta: 'Quando o "-ed" adiciona uma nova sílaba ao verbo?',
        opcoes: [
          'Apenas quando o verbo termina em som de T ou D',
          'Sempre em todos os verbos regulares',
          'Apenas após vogais',
        ],
        resposta_correta: 'Apenas quando o verbo termina em som de T ou D',
        explicacao: 'Exemplos: wanted, needed, decided. Nos demais, o -ed não cria nova sílaba.',
      },
    ],
    flashcards: [
      {
        frente: 'Worked (/wɜːkt/)',
        verso: 'Passado de work (1 sílaba)',
        dica: 'Som de T seco no final.',
      },
      {
        frente: 'Decided (/dɪˈsaɪ.dɪd/)',
        verso: 'Passado de decide (3 sílabas com terminação /ɪd/)',
        dica: 'Termina em D, logo recebe /ɪd/.',
      },
    ],
    conteudo_markdown: `# Pronúncia Fonética do -ED Regular\n\nDomine as 3 regras essenciais:\n- Som de /t/: após k, p, s, sh, ch, f\n- Som de /d/: após l, v, n, m, r, b, g e vogais\n- Som de /ɪd/: após t e d`,
    criado_em: new Date().toISOString(),
    adicionado_ao_grafo: true,
  },
];

// Dados Iniciais do Grafo focados em Aprendizado de Idiomas
export const SEED_NODES: GraphNode[] = [
  {
    id: 'node-topico-1',
    tipo: 'topico',
    titulo: 'Inglês Conversacional e Fluência',
    descricao: 'Desenvolvimento de fluência oral, vocabulário natural e superação de vícios de tradução.',
    dominio_estimado: 75,
    dificuldade: 3,
    frequencia_erro: 2,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 1 * 86400000).toISOString(),
    evidencias: ['Praticou conversação sobre rotinas e viagens com o tutor'],
    criado_em: new Date(Date.now() - 5 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 2 * 86400000).toISOString(),
    idioma: 'Inglês',
  },
  {
    id: 'node-vocab-1',
    tipo: 'vocabulario',
    titulo: 'Collocation: Ask a question (vs Make a question)',
    descricao: 'Padrão nativo: usa-se "ask a question" e não a tradução literal do português "make a question".',
    dominio_estimado: 88,
    dificuldade: 2,
    frequencia_erro: 1,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 3 * 86400000).toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Corrigiu a formulação em diálogo e usou "May I ask you a question?"'],
    criado_em: new Date(Date.now() - 5 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    pronuncia_ipa: '/æsk ə ˈkwɛstʃən/',
    traducao: 'Fazer uma pergunta',
    exemplo_uso: 'Can I ask you a quick question about this topic?',
  },
  {
    id: 'node-falso-amigo-1',
    tipo: 'falso_amigo',
    titulo: 'Actually vs Atualmente',
    descricao: '"Actually" significa "na verdade / de fato". Para "atualmente", utiliza-se "currently" ou "nowadays".',
    dominio_estimado: 55,
    dificuldade: 3,
    frequencia_erro: 3,
    ultima_revisao: new Date(Date.now() - 3 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(), // Precisa revisar hoje!
    topico_pai: 'node-topico-1',
    evidencias: ['Utilizou "Actually I am working..." querendo dizer atualmente'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'Actually = Na verdade / De fato | Currently = Atualmente',
    exemplo_uso: 'Actually, I prefer tea over coffee.',
  },
  {
    id: 'node-falso-amigo-2',
    tipo: 'falso_amigo',
    titulo: 'Pretend vs Intend',
    descricao: '"Pretend" significa fingir. Para dizer fingir que vai fazer algo, usa-se pretend. Para pretender/ter intenção, usa-se intend.',
    dominio_estimado: 48,
    dificuldade: 4,
    frequencia_erro: 2,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Disse "I pretend to travel" em vez de "I intend to travel"'],
    criado_em: new Date(Date.now() - 3 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 2 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'Pretend = Fingir | Intend = Pretender',
    exemplo_uso: 'I intend to master English this year.',
  },
  {
    id: 'node-falso-amigo-3',
    tipo: 'falso_amigo',
    titulo: 'Push vs Puxe (Push vs Pull)',
    descricao: 'Na porta ou em objetos, "Push" significa "Empurrar". Para "Puxar", a palavra correta em inglês é "Pull".',
    dominio_estimado: 60,
    dificuldade: 2,
    frequencia_erro: 2,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 1 * 86400000).toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Confusão clássica em portas e orientações de movimento.'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'Push = Empurrar | Pull = Puxar',
    exemplo_uso: 'Push the door to open it; pull the handle to close it.',
  },
  {
    id: 'node-vocab-2',
    tipo: 'vocabulario',
    titulo: 'Borrow vs Lend (Pedir vs Dar Emprestado)',
    descricao: '"Borrow" é pegar emprestado de alguém ("May I borrow your pen?"). "Lend" é dar emprestado para alguém ("Can you lend me $10?").',
    dominio_estimado: 52,
    dificuldade: 3,
    frequencia_erro: 3,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Disse "Can you borrow me your book?"'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'Borrow = Pegar emprestado | Lend = Emprestar para outrem',
    exemplo_uso: 'Can I borrow your laptop? I promise to lend you my notes later.',
  },
  {
    id: 'node-gramatica-2',
    tipo: 'gramatica',
    titulo: 'In time vs On time',
    descricao: '"On time" significa pontual, no minuto agendado (ex: o trem das 8h saiu às 8h). "In time" significa a tempo, antes que seja tarde demais.',
    dominio_estimado: 72,
    dificuldade: 3,
    frequencia_erro: 1,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 2 * 86400000).toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Compreendeu a nuance com o exemplo do voo e do alarme.'],
    criado_em: new Date(Date.now() - 3 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'On time = Pontual / No horário | In time = A tempo (com margem)',
    exemplo_uso: 'The meeting started on time at 9:00 AM, and I arrived just in time to get coffee.',
  },
  {
    id: 'node-collocation-1',
    tipo: 'vocabulario',
    titulo: 'Do Homework vs Make Homework',
    descricao: 'Usa-se "Do" para tarefas, deveres e obrigações diárias (do homework, do business, do exercise). "Make" é para criar ou produzir algo tangível (make food, make a mistake, make money).',
    dominio_estimado: 80,
    dificuldade: 2,
    frequencia_erro: 1,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 3 * 86400000).toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Corrigiu "make homework" para "do homework".'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 2 * 86400000).toISOString(),
    idioma: 'Inglês',
    traducao: 'Do homework = Fazer lição de casa',
    exemplo_uso: 'I always do my English homework before dinner.',
  },
  {
    id: 'node-pronuncia-1',
    tipo: 'dificuldade',
    titulo: 'Pronúncia do "-ed" Final em Verbos Regulares',
    descricao: 'O "-ed" tem 3 sons: /t/ (após sons mudos como p, k, s), /d/ (após sons sonoros como l, v, n) e /ɪd/ (apenas após som de T ou D como wanted, decided). Brasileiros tendem a adicionar a sílaba "edji" em todos.',
    dominio_estimado: 58,
    dificuldade: 4,
    frequencia_erro: 3,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Pronunciou "worked" como "work-edji" em vez do monossílabo /wɜːkt/.'],
    criado_em: new Date(Date.now() - 3 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    pronuncia_ipa: '/wɜːkt/ (não "work-ed")',
    traducao: 'Regra de terminação do passado regular',
    exemplo_uso: 'She worked /wɜːkt/ hard and called /kɔːld/ her teacher.',
  },
  {
    id: 'node-gramatica-1',
    tipo: 'gramatica',
    titulo: 'Present Perfect vs Simple Past',
    descricao: 'Uso do Present Perfect para experiências sem tempo especificado, e Simple Past com marcadores como "yesterday", "in 2020".',
    dominio_estimado: 68,
    dificuldade: 3,
    frequencia_erro: 2,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 2 * 86400000).toISOString(),
    topico_pai: 'node-topico-1',
    evidencias: ['Explicou a diferença entre "I have been to London" e "I went to London in 2019"'],
    criado_em: new Date(Date.now() - 5 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
  },
  {
    id: 'node-expressao-1',
    tipo: 'expressao_idiomatica',
    titulo: 'Get the hang of (Pegar o jeito)',
    descricao: 'Expressão muito comum para indicar que você está aprendendo a dominar uma habilidade.',
    dominio_estimado: 90,
    dificuldade: 2,
    frequencia_erro: 0,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 5 * 86400000).toISOString(),
    evidencias: ['Usou perfeitamente em frase livre na sessão de voz'],
    criado_em: new Date(Date.now() - 2 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Inglês',
    pronuncia_ipa: '/ɡɛt ðə hæŋ ɒv/',
    traducao: 'Pegar o jeito / Dominar a prática',
    exemplo_uso: 'It takes time, but you will soon get the hang of it!',
  },
  // Nó em Espanhol: Falsos Amigos & Vocabulário
  {
    id: 'node-es-falso-1',
    tipo: 'falso_amigo',
    titulo: 'Embarazada vs Apenada',
    descricao: 'Em espanhol, "Embarazada" significa gestante/grávida. Para "envergonhada/sem jeito", usa-se "apenada" ou "avergonzada".',
    dominio_estimado: 45,
    dificuldade: 3,
    frequencia_erro: 4,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(),
    evidencias: ['Disse "Estoy embarazada" querendo expressar timidez em reunião.'],
    criado_em: new Date(Date.now() - 3 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Espanhol',
    pronuncia_ipa: '/embaɾaˈsaða/',
    traducao: 'Grávida / Gestante (NÃO envergonhada)',
    exemplo_uso: 'Ella está embarazada de cinco meses y muy feliz.',
  },
  {
    id: 'node-es-falso-2',
    tipo: 'falso_amigo',
    titulo: 'Exquisito (Delicioso vs Esquisito)',
    descricao: 'No mundo hispânico, "Exquisito" é um elogio supremo de culinária e sabor (delicioso). Para algo estranho/bizarro, usa-se "raro" ou "extraño".',
    dominio_estimado: 60,
    dificuldade: 3,
    frequencia_erro: 2,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 1 * 86400000).toISOString(),
    evidencias: ['Hesitou ao elogiar uma refeição em espanhol.'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Espanhol',
    pronuncia_ipa: '/ekskiˈsito/',
    traducao: 'Delicioso / Saborosíssimo / Refinado',
    exemplo_uso: '¡La paella que preparaste estaba realmente exquisita!',
  },
  {
    id: 'node-es-expressao-1',
    tipo: 'expressao_idiomatica',
    titulo: 'Echar de menos (Sentir saudades)',
    descricao: 'Expressão castelhana correspondente a "sentir falta / saudades" de alguém ou de um lugar.',
    dominio_estimado: 75,
    dificuldade: 2,
    frequencia_erro: 1,
    ultima_revisao: new Date(Date.now() - 1 * 86400000).toISOString(),
    proxima_revisao: new Date(Date.now() + 3 * 86400000).toISOString(),
    evidencias: ['Utilizou em diálogo sobre viagens com o tutor.'],
    criado_em: new Date(Date.now() - 4 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Espanhol',
    pronuncia_ipa: '/eˈtʃaɾ ðe ˈmenos/',
    traducao: 'Sentir saudades / Sentir falta',
    exemplo_uso: 'Te echo mucho de menos cuando estoy lejos de casa.',
  },
  // Nó em Francês: Falsos Cognatos & Pronúncia
  {
    id: 'node-fr-falso-1',
    tipo: 'falso_amigo',
    titulo: 'Attendre vs Entendre',
    descricao: '"Attendre" significa esperar/aguardar. "Entendre" significa ouvir/escutar.',
    dominio_estimado: 50,
    dificuldade: 3,
    frequencia_erro: 3,
    ultima_revisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    proxima_revisao: new Date().toISOString(),
    evidencias: ['Confundiu attendre com atender telefonema.'],
    criado_em: new Date(Date.now() - 3 * 86400000).toISOString(),
    atualizado_em: new Date(Date.now() - 1 * 86400000).toISOString(),
    idioma: 'Francês',
    pronuncia_ipa: '/a.tɑ̃dʁ/',
    traducao: 'Esperar / Aguardar',
    exemplo_uso: "J'attends ton arrivée à la gare.",
  },
];


export const SEED_RELATIONS: GraphRelation[] = [
  {
    id: 'rel-1',
    origem_id: 'node-vocab-1',
    destino_id: 'node-topico-1',
    tipo: 'relacionado_a',
    peso: 0.9,
    criado_em: new Date().toISOString(),
  },
  {
    id: 'rel-2',
    origem_id: 'node-falso-amigo-1',
    destino_id: 'node-topico-1',
    tipo: 'confundido_com',
    peso: 0.85,
    evidencia: 'Confusão recorrente entre Actually e Atualmente',
    criado_em: new Date().toISOString(),
  },
  {
    id: 'rel-3',
    origem_id: 'node-falso-amigo-2',
    destino_id: 'node-topico-1',
    tipo: 'confundido_com',
    peso: 0.8,
    evidencia: 'Confusão entre Pretend e Intend',
    criado_em: new Date().toISOString(),
  },
  {
    id: 'rel-4',
    origem_id: 'node-gramatica-1',
    destino_id: 'node-topico-1',
    tipo: 'pre_requisito_de',
    peso: 0.95,
    criado_em: new Date().toISOString(),
  },
  {
    id: 'rel-5',
    origem_id: 'node-expressao-1',
    destino_id: 'node-topico-1',
    tipo: 'relacionado_a',
    peso: 0.75,
    criado_em: new Date().toISOString(),
  },
];

export const SEED_CORRECTIONS: PedagogicalCorrection[] = [
  {
    id: 'corr-1',
    conceito: 'Collocations & Falso Amigo',
    erro: 'Disse "I would like to make a question, actually I am studying now."',
    explicacao:
      'Em inglês, a combinação correta é "ask a question" (não "make"). Além disso, "actually" significa "na verdade". Para dizer "atualmente", usa-se "currently" ou "right now".',
    resposta_corrigida:
      'I would like to ask a question; currently, I am studying English.',
    gravidade: 'moderada',
    data: new Date(Date.now() - 2 * 86400000).toISOString(),
    evidencia: 'Estudante: "Can I make a question? Actually I live in Brazil."',
    estado_posterior: 'compreendido',
    pergunta_confirmacao:
      'Qual verbo usamos com "question" para pedir uma informação em inglês?',
    respondido_corretamente: true,
    dica_pronuncia_ou_gramatica: 'Pratique: /æsk ə ˈkwɛstʃən/ com connected speech.',
  },
  {
    id: 'corr-2',
    conceito: 'Pretend vs Intend',
    erro: 'Usou "I pretend to travel abroad next year" para indicar planos futuros.',
    explicacao:
      '"Pretend" é um falso amigo clássico que significa "fingir". Para expressar sua intenção ou plano futuro, o verbo correto é "intend" ou a estrutura "plan to".',
    resposta_corrigida:
      'I intend to travel abroad next year (ou "I plan to travel").',
    gravidade: 'moderada',
    data: new Date(Date.now() - 1 * 86400000).toISOString(),
    evidencia: 'Estudante: "I pretend to visit London."',
    estado_posterior: 'precisa_revisar',
    pergunta_confirmacao:
      'O que a frase "He is pretending to be asleep" realmente significa em português?',
    respondido_corretamente: false,
    dica_pronuncia_ou_gramatica: 'Pretend = Fingir / Intend = Ter intenção.',
  },
  {
    id: 'corr-3',
    conceito: 'Borrow vs Lend',
    erro: 'Disse "Can you borrow me your book for the exam?"',
    explicacao:
      '"Borrow" significa tomar emprestado (pegar). O verbo para conceder/dar emprestado a alguém é "lend". Logo, a frase correta com "you" é "Can you lend me..." ou com "I": "Can I borrow your book?".',
    resposta_corrigida:
      'Can you lend me your book? (ou "Can I borrow your book?")',
    gravidade: 'moderada',
    data: new Date(Date.now() - 1 * 86400000).toISOString(),
    evidencia: 'Estudante: "I forgot my notes. Please borrow me yours."',
    estado_posterior: 'pendente',
    pergunta_confirmacao:
      'Qual verbo usamos quando QUEREMOS PEDIR algo emprestado para nós mesmos?',
    respondido_corretamente: false,
    dica_pronuncia_ou_gramatica: 'Borrow FROM someone / Lend TO someone.',
  },
  {
    id: 'corr-4',
    conceito: 'Pronúncia do "-ed" regular',
    erro: 'Pronunciou "I worked yesterday" como "I work-edji yesterday".',
    explicacao:
      'O verbo "work" termina no som surdo /k/. O sufixo "-ed" assume o som de /t/ sem adicionar nova sílaba, soando como /wɜːkt/. Nunca adicione uma vogal de apoio no final.',
    resposta_corrigida:
      'I worked /wɜːkt/ yesterday.',
    gravidade: 'leve',
    data: new Date(Date.now() - 1 * 86400000).toISOString(),
    evidencia: 'Transcrição de áudio: inserção de vogal epentética [i] em verbos regulares.',
    estado_posterior: 'precisa_revisar',
    pergunta_confirmacao:
      'Quantas sílabas tem a palavra "worked" falada em inglês nativo?',
    respondido_corretamente: false,
    dica_pronuncia_ou_gramatica: 'Apenas 1 sílaba: /wɜːkt/ (som de T estalado).',
  },
  {
    id: 'corr-5',
    conceito: 'Do vs Make Collocations',
    erro: 'Escreveu "I need to make my homework before the class."',
    explicacao:
      'Deveres de casa, atividades físicas e tarefas rotineiras usam o verbo "do" (do homework, do the dishes, do yoga). "Make" é reservado para fabricar, criar ou cozinhar (make dinner, make a mistake).',
    resposta_corrigida:
      'I need to do my homework before the class.',
    gravidade: 'leve',
    data: new Date(Date.now() - 2 * 86400000).toISOString(),
    evidencia: 'Estudante: "I made all my homework yesterday."',
    estado_posterior: 'compreendido',
    pergunta_confirmacao:
      'Dizemos "make exercise" ou "do exercise"?',
    respondido_corretamente: true,
    dica_pronuncia_ou_gramatica: 'Regra de ouro: Do para tarefas/ações; Make para criações.',
  },
];

export const SEED_SESSIONS: StudySession[] = [
  {
    id: 'sess-1',
    titulo: 'Conversação: Connected Speech & Collocations',
    topico: 'Inglês Conversacional e Fluência',
    inicio: new Date(Date.now() - 3 * 86400000).toISOString(),
    fim: new Date(Date.now() - 3 * 86400000 + 35 * 60000).toISOString(),
    duracao_minutos: 35,
    respostas_totais: 6,
    respostas_corretas: 5,
    conceitos_trabalhados: ['Connected Speech', 'Ask a question', 'Present Perfect'],
    erros_identificados: 1,
    xp_obtido: 130,
    concluida: true,
  },
  {
    id: 'sess-2',
    titulo: 'Treino de Vocabulário & Falsos Cognatos',
    topico: 'Inglês Conversacional e Fluência',
    inicio: new Date(Date.now() - 1 * 86400000).toISOString(),
    fim: new Date(Date.now() - 1 * 86400000 + 30 * 60000).toISOString(),
    duracao_minutos: 30,
    respostas_totais: 8,
    respostas_corretas: 6,
    conceitos_trabalhados: ['Actually vs Currently', 'Pretend vs Intend'],
    erros_identificados: 2,
    xp_obtido: 140,
    concluida: true,
  },
];

// Estado do Usuário Ativo
let _currentUserId = 'default_user';
let _currentUserProfile: UserProfile | null = null;
let _syncTimeout: any = null;

export const StorageService = {
  // Configuração do Usuário Atual para isolamento de dados
  setCurrentUser(user: UserProfile | null) {
    _currentUserProfile = user;
    _currentUserId = user ? user.uid : 'default_user';
    clearStorageCache();
  },

  getCurrentUser(): UserProfile | null {
    return _currentUserProfile;
  },

  getCurrentUserId(): string {
    return _currentUserId;
  },

  // Retorna a chave com namespace do usuário ativo
  getKey(baseKey: string): string {
    if (!_currentUserId || _currentUserId === 'default_user') {
      return baseKey;
    }
    return `${baseKey}_${_currentUserId}`;
  },

  // Meta de sincronização por usuário: carimbos das mutações locais e contagem
  // de chunks já recebidos da nuvem, por coleção. Vive numa chave própria
  // (tutor_sync_meta_v1) e não interfere nas chaves existentes.
  getLocalSyncStamp(col: SyncCollection): string | null {
    return readSyncMeta(this.getKey(SYNC_META_KEY)).stamps[col] || null;
  },

  touchLocalSyncStamp(col: SyncCollection, at: string = new Date().toISOString()) {
    const key = this.getKey(SYNC_META_KEY);
    const meta = readSyncMeta(key);
    meta.stamps[col] = at;
    writeSyncMeta(key, meta);
  },

  getCloudChunkCount(col: SyncCollection): number {
    return readSyncMeta(this.getKey(SYNC_META_KEY)).cloudChunks[col] || 0;
  },

  setCloudChunkCount(col: SyncCollection, count: number) {
    const key = this.getKey(SYNC_META_KEY);
    const meta = readSyncMeta(key);
    meta.cloudChunks[col] = count;
    writeSyncMeta(key, meta);
  },

  // Dispara sincronização em segundo plano com a nuvem (Firestore)
  scheduleCloudSync() {
    if (!_currentUserId || _currentUserId === 'default_user') return;
    if (_syncTimeout) clearTimeout(_syncTimeout);

    _syncTimeout = setTimeout(async () => {
      try {
        const stats = this.getStats();
        const nodes = this.getNodes();
        const materials = this.getMaterials();
        const relations = this.getRelations();
        const corrections = this.getCorrections();

        await syncPersonalKnowledgeToCloud(_currentUserId, {
          stats,
          nodes,
          materials,
          relations,
          corrections,
        });

        // Atualiza resumo de progresso no perfil do usuário
        await updateUserStatsSummary(_currentUserId, {
          level: stats.nivel,
          xp: stats.xp,
          streak: stats.sequencia_dias,
          nodesCount: nodes.length,
          materialsCount: materials.length,
        });
      } catch (err) {
        console.warn('Erro durante sincronização com o Firestore:', err);
      }
    }, 1500);
  },

  // Carrega e hidrata dados da nuvem para o usuário atual. Aplica cada coleção
  // só quando o carimbo da nuvem é mais novo que o local (ou o local está
  // vazio), evitando que um login num dispositivo defasado sobrescreva dados
  // mais recentes.
  async hydrateFromCloud(userId: string): Promise<boolean> {
    if (!userId || userId === 'default_user') return false;

    try {
      const fetched = await fetchPersonalKnowledgeFromCloud(userId);
      if (!fetched) return false;
      const { data, updatedAt } = fetched;

      let hasData = false;
      const applyIfNewer = (col: SyncCollection, apply: () => void): boolean => {
        const localStamp = this.getLocalSyncStamp(col);
        const shouldApply = shouldApplyCloudCollection({
          localIsEmpty: localStamp === null,
          localStamp,
          cloudUpdatedAt: updatedAt[col],
        });
        if (!shouldApply) return false;
        apply();
        // apply() tocou o carimbo com "agora"; restaura o carimbo da nuvem para
        // que a próxima comparação use o instante real do dado aplicado.
        if (updatedAt[col]) this.touchLocalSyncStamp(col, updatedAt[col]);
        return true;
      };

      if (data.stats && applyIfNewer('stats', () => this.saveStats(data.stats!, false))) hasData = true;
      if (data.materials && data.materials.length > 0 && applyIfNewer('materials', () => this.saveMaterials(data.materials!, false))) hasData = true;
      if (data.nodes && data.nodes.length > 0 && applyIfNewer('nodes', () => this.saveNodes(data.nodes!, false))) hasData = true;
      if (data.relations && data.relations.length > 0 && applyIfNewer('relations', () => this.saveRelations(data.relations!, false))) hasData = true;
      if (data.corrections && data.corrections.length > 0 && applyIfNewer('corrections', () => this.saveCorrections(data.corrections!, false))) hasData = true;
      return hasData;
    } catch (err) {
      console.warn('Erro ao hidratar dados da nuvem:', err);
      return false;
    }
  },

  // Materiais de Estudo (YouTube, Textos, Arquivos)
  getMaterials(): StudyMaterialItem[] {
    return readJsonCached<StudyMaterialItem[]>(this.getKey(STORAGE_KEYS.MATERIALS)) ?? [];
  },

  saveMaterials(materials: StudyMaterialItem[], sync = true) {
    // Limita a lista de materiais antes de persistir (corta os mais antigos,
    // que ficam no fim após o unshift de addMaterial).
    writeJsonCached(this.getKey(STORAGE_KEYS.MATERIALS), materials.slice(0, STORAGE_LIMITS.maxMaterials));
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('materials');
    if (sync) this.scheduleCloudSync();
  },

  addMaterial(material: StudyMaterialItem): StudyMaterialItem {
    const list = this.getMaterials();
    list.unshift(material);
    this.saveMaterials(list);
    // Incrementa contagem nas estatísticas
    const stats = this.getStats();
    stats.materiais_gerados = (stats.materiais_gerados || 0) + 1;
    this.saveStats(stats);
    return material;
  },

  updateMaterial(material: StudyMaterialItem) {
    const list = this.getMaterials();
    const idx = list.findIndex((m) => m.id === material.id);
    if (idx >= 0) {
      list[idx] = material;
      this.saveMaterials(list);
    }
  },

  deleteMaterial(id: string) {
    const list = this.getMaterials().filter((m) => m.id !== id);
    this.saveMaterials(list);
  },

  // Nós do Grafo
  getNodes(): GraphNode[] {
    return readJsonCached<GraphNode[]>(this.getKey(STORAGE_KEYS.NODES)) ?? [];
  },

  saveNodes(nodes: GraphNode[], sync = true) {
    writeJsonCached(this.getKey(STORAGE_KEYS.NODES), nodes);
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('nodes');
    if (sync) this.scheduleCloudSync();
  },

  addOrUpdateNode(node: GraphNode): GraphNode {
    const nodes = this.getNodes();
    const index = nodes.findIndex((n) => n.id === node.id);
    if (index >= 0) {
      nodes[index] = { ...nodes[index], ...node, atualizado_em: new Date().toISOString() };
    } else {
      nodes.push(node);
    }
    this.saveNodes(nodes);
    return node;
  },

  deleteNode(id: string) {
    const nodes = this.getNodes().filter((n) => n.id !== id);
    this.saveNodes(nodes);
    // Remove relações associadas
    const relations = this.getRelations().filter(
      (r) => r.origem_id !== id && r.destino_id !== id
    );
    this.saveRelations(relations);
  },

  // Relações do Grafo
  getRelations(): GraphRelation[] {
    return readJsonCached<GraphRelation[]>(this.getKey(STORAGE_KEYS.RELATIONS)) ?? [];
  },

  saveRelations(relations: GraphRelation[], sync = true) {
    writeJsonCached(this.getKey(STORAGE_KEYS.RELATIONS), relations);
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('relations');
    if (sync) this.scheduleCloudSync();
  },

  addRelation(rel: GraphRelation) {
    const relations = this.getRelations();
    const exists = relations.some(
      (r) =>
        r.origem_id === rel.origem_id &&
        r.destino_id === rel.destino_id &&
        r.tipo === rel.tipo
    );
    if (!exists) {
      relations.push(rel);
      this.saveRelations(relations);
    }
  },

  // Correções Pedagógicas
  getCorrections(): PedagogicalCorrection[] {
    return readJsonCached<PedagogicalCorrection[]>(this.getKey(STORAGE_KEYS.CORRECTIONS)) ?? [];
  },

  saveCorrections(corrections: PedagogicalCorrection[], sync = true) {
    writeJsonCached(this.getKey(STORAGE_KEYS.CORRECTIONS), corrections);
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('corrections');
    if (sync) this.scheduleCloudSync();
  },

  addCorrection(corr: PedagogicalCorrection) {
    const list = this.getCorrections();
    list.unshift(corr);
    this.saveCorrections(list);
  },

  updateCorrectionStatus(id: string, status: 'pendente' | 'compreendido' | 'precisa_revisar', correct?: boolean) {
    const list = this.getCorrections();
    const item = list.find((c) => c.id === id);
    if (item) {
      item.estado_posterior = status;
      if (correct !== undefined) {
        item.respondido_corretamente = correct;
      }
      this.saveCorrections(list);
    }
  },

  // =========================================================================
  // SISTEMA DE MULTI-CONVERSAS & SESSÕES POR LIÇÃO (ChatConversation)
  // =========================================================================
  getConversations(initialize = true): ChatConversation[] {
    const cached = readJsonCached<ChatConversation[]>(this.getKey(STORAGE_KEYS.CONVERSATIONS));
    if (cached && cached.length > 0) {
      return cached;
    }

    if (!initialize) return [];

    // Migração ou inicialização padrão: cria a primeira conversa a partir do histórico antigo ou plano
    const stats = this.getStats();
    const plan = this.getStudyPlan();
    const lang = plan?.idioma || stats.idioma_ativo || 'Inglês';
    const legacyHistory = this.getLegacyChatHistory();

    const initialConvId = `conv-default-${Date.now()}`;
    let initialMessages: ChatMessage[] = legacyHistory;

    if (initialMessages.length === 0) {
      let initialContent = '';
      if (plan && plan.mensagem_boas_vindas_tutor) {
        initialContent = plan.mensagem_boas_vindas_tutor;
      } else {
        const greetingsByLang: Record<string, string> = {
          'Inglês':
            'Hello! Welcome to your Language Tutor. Estou aqui para destravar sua fala, corrigir vícios de tradução e falsos amigos, e praticar conversação no seu ritmo. Qual idioma e tópico vamos praticar hoje?',
          'Francês':
            'Bonjour ! Bienvenue à votre tuteur de français. Estou aqui para destravar sua conversação e pronúncia em francês. Vamos começar nossa prática?',
          'Espanhol':
            '¡Hola! Bienvenido a tu tutor de español. Estoy aquí para ayudarte a hablar con fluidez y soltura. ¿Qué tema te gustaría practicar hoy?',
          'Alemão':
            'Hallo! Willkommen zu deinem Sprach-Tutor. Estou aqui para te ajudar com estruturas e conversação em alemão. Vamos começar?',
          'Italiano':
            'Ciao! Benvenuto al tuo tutor di italiano. Sono qui per aiutarti a parlare italiano con scioltezza e sicurezza. Cosa vorresti praticare oggi?',
          'Japonês':
            'Konnichiwa! (こんにちは!) Bem-vindo ao seu tutor de japonês. Estou pronto para praticar frases úteis e vocabulário com você. Vamos começar?',
        };
        initialContent =
          greetingsByLang[lang] ||
          `Olá! Bem-vindo ao seu tutor de ${lang}. Qual tópico ou situação prática vamos treinar hoje?`;
      }

      initialMessages = [
        {
          id: `welcome-${Date.now()}`,
          remetente: 'tutor',
          conteudo: initialContent,
          timestamp: new Date().toISOString(),
          idioma: lang,
          conceitos_chave: plan?.interesses_principais,
        },
      ];
    }

    const now = Date.now();
    const defaultConv: ChatConversation = {
      id: initialConvId,
      titulo: plan?.topico_inicial_recomendado ? `Plano: ${plan.topico_inicial_recomendado}` : 'Connected Speech & Pronúncia Natural',
      topico: plan?.topico_inicial_recomendado || `${lang}: Connected Speech & Pronúncia Natural`,
      idioma: lang,
      material_id: plan?.primeiro_material_estudo?.id,
      material_titulo: plan?.primeiro_material_estudo?.titulo,
      criado_em: new Date(now - 1000 * 60 * 45).toISOString(),
      atualizado_em: new Date(now - 1000 * 60 * 10).toISOString(),
      mensagens: initialMessages,
      nivel_cefr: plan?.nivel_cefr || stats.nivel_cefr || 'B1',
      total_mensagens: initialMessages.length,
    };

    // Gera sessões recentes realistas caso o usuário esteja no primeiro acesso
    const pastConvs: ChatConversation[] = [
      {
        id: `conv-seed-work-${now - 86400000}`,
        titulo: 'Phrasal Verbs no Trabalho & Reuniões',
        topico: `${lang}: Phrasal Verbs Essenciais no Trabalho`,
        idioma: lang,
        criado_em: new Date(now - 86400000).toISOString(),
        atualizado_em: new Date(now - 82800000).toISOString(),
        nivel_cefr: 'B2',
        total_mensagens: 4,
        mensagens: [
          {
            id: `seed-msg-1`,
            remetente: 'tutor',
            conteudo: 'Let\'s practice workplace expressions! Imagine you need to finish a report before 5 PM. How would you tell your team using "wrap up"?',
            timestamp: new Date(now - 86400000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-msg-2`,
            remetente: 'user',
            conteudo: 'I need to wrap up this project report before the meeting today.',
            timestamp: new Date(now - 85000000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-msg-3`,
            remetente: 'tutor',
            conteudo: 'Spot on! "Wrap up" is natural and professional here. What about scheduling a quick follow-up: how would you ask to "touch base"?',
            timestamp: new Date(now - 82800000).toISOString(),
            idioma: lang,
          },
        ],
      },
      {
        id: `conv-seed-falsefriends-${now - 172800000}`,
        titulo: 'Falsos Amigos & Vícios de Tradução',
        topico: `${lang}: Falsos Amigos & Vícios de Tradução`,
        idioma: lang,
        criado_em: new Date(now - 172800000).toISOString(),
        atualizado_em: new Date(now - 170000000).toISOString(),
        nivel_cefr: 'B1',
        total_mensagens: 4,
        mensagens: [
          {
            id: `seed-ff-1`,
            remetente: 'tutor',
            conteudo: 'Muitos alunos confundem "actually" e "currently". Como você diria "Eu atualmente moro em São Paulo"?',
            timestamp: new Date(now - 172800000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-ff-2`,
            remetente: 'user',
            conteudo: 'I currently live in São Paulo, but I actually want to move abroad soon.',
            timestamp: new Date(now - 170000000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-ff-3`,
            remetente: 'tutor',
            conteudo: 'Perfeito! Você usou os dois termos de forma exemplar no mesmo contexto.',
            timestamp: new Date(now - 169000000).toISOString(),
            idioma: lang,
          },
        ],
      },
      {
        id: `conv-seed-cafe-${now - 259200000}`,
        titulo: 'Simulação: Pedindo Café em Londres',
        topico: `${lang}: Conversação Cotidiana & Situações Reais`,
        idioma: lang,
        criado_em: new Date(now - 259200000).toISOString(),
        atualizado_em: new Date(now - 256000000).toISOString(),
        nivel_cefr: 'A2',
        total_mensagens: 3,
        mensagens: [
          {
            id: `seed-cafe-1`,
            remetente: 'tutor',
            conteudo: 'Welcome to Costa Coffee! What can I get for you today?',
            timestamp: new Date(now - 259200000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-cafe-2`,
            remetente: 'user',
            conteudo: 'Could I please have an oat latte to go with an extra shot?',
            timestamp: new Date(now - 256000000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-cafe-3`,
            remetente: 'tutor',
            conteudo: 'Sure thing! That will be £3.80. Would you like to pay with card or contactless?',
            timestamp: new Date(now - 255000000).toISOString(),
            idioma: lang,
          },
        ],
      },
      {
        id: `conv-seed-smalltalk-${now - 345600000}`,
        titulo: 'Small Talk & Quebra-Gelo Cotidiano',
        topico: `${lang}: Conversação Espontânea & Fluência`,
        idioma: lang,
        criado_em: new Date(now - 345600000).toISOString(),
        atualizado_em: new Date(now - 340000000).toISOString(),
        nivel_cefr: 'B1',
        total_mensagens: 3,
        mensagens: [
          {
            id: `seed-st-1`,
            remetente: 'tutor',
            conteudo: 'Small talk is great for building rapport. Try commenting on the weekend or the weather to start naturally!',
            timestamp: new Date(now - 345600000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-st-2`,
            remetente: 'user',
            conteudo: 'Did you get up to anything exciting over the weekend?',
            timestamp: new Date(now - 340000000).toISOString(),
            idioma: lang,
          },
          {
            id: `seed-st-3`,
            remetente: 'tutor',
            conteudo: 'Excelente uso de "get up to"! É uma expressão tipicamente nativa para perguntar o que alguém fez no fim de semana.',
            timestamp: new Date(now - 339000000).toISOString(),
            idioma: lang,
          },
        ],
      },
    ];

    const list = [defaultConv, ...pastConvs];
    this.saveConversations(list, false);
    this.setActiveConversationId(initialConvId);
    return list;
  },

  getRecentConversations(limit = 5): ChatConversation[] {
    const list = this.getConversations();
    return [...list]
      .sort((a, b) => {
        const timeA = new Date(a.atualizado_em || a.criado_em || 0).getTime();
        const timeB = new Date(b.atualizado_em || b.criado_em || 0).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);
  },

  saveConversations(conversations: ChatConversation[], sync = true) {
    // Aplica limite de tamanho antes de persistir: mantém só as N conversas
    // mais recentes com as últimas M mensagens de cada (evita estourar a cota).
    writeJsonCached(this.getKey(STORAGE_KEYS.CONVERSATIONS), trimConversations(conversations));
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('conversations');
    if (sync) {
      const active = this.getActiveConversation();
      if (active) {
        writeJsonCached(this.getKey(STORAGE_KEYS.CHATS), active.mensagens);
      }
    }
  },

  getActiveConversationId(): string {
    let id = localStorage.getItem(this.getKey(STORAGE_KEYS.ACTIVE_CONVERSATION_ID));
    if (!id) {
      const convs = this.getConversations();
      if (convs.length > 0) {
        id = convs[0].id;
        this.setActiveConversationId(id);
      } else {
        id = `conv-${Date.now()}`;
      }
    }
    return id;
  },

  setActiveConversationId(id: string) {
    localStorage.setItem(this.getKey(STORAGE_KEYS.ACTIVE_CONVERSATION_ID), id);
    const conv = this.getConversation(id);
    if (conv) {
      localStorage.setItem(this.getKey(STORAGE_KEYS.CHATS), JSON.stringify(conv.mensagens));
    }
  },

  getActiveConversation(): ChatConversation {
    const convs = this.getConversations();
    const activeId = this.getActiveConversationId();
    const found = convs.find((c) => c.id === activeId);
    if (found) return found;
    if (convs.length > 0) {
      this.setActiveConversationId(convs[0].id);
      return convs[0];
    }
    const newConv = this.createConversation({
      titulo: 'Conversa Geral',
      topico: 'Conversação Geral',
    });
    return newConv;
  },

  getConversation(id: string): ChatConversation | undefined {
    const convs = this.getConversations();
    return convs.find((c) => c.id === id);
  },

  getConversationsByMaterialId(materialId: string): ChatConversation[] {
    const convs = this.getConversations();
    return convs.filter((c) => c.material_id === materialId);
  },

  /**
   * Cria uma NOVA conversa dedicada a uma lição / material de estudo ou tópico livre
   */
  createConversation(options: {
    titulo?: string;
    topico: string;
    idioma?: string;
    materialId?: string;
    materialTitulo?: string;
    nivelCefr?: CEFRLevel;
    initialMessage?: string;
  }): ChatConversation {
    const stats = this.getStats();
    const plan = this.getStudyPlan();
    const lang = options.idioma || stats.idioma_ativo || plan?.idioma || 'Inglês';
    const cefr = options.nivelCefr || stats.nivel_cefr || plan?.nivel_cefr || 'B1';

    let materialItem: StudyMaterialItem | undefined = undefined;
    if (options.materialId) {
      materialItem = this.getMaterials().find((m) => m.id === options.materialId);
    }

    const convId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const convTitle =
      options.titulo ||
      (materialItem ? `Lição: ${materialItem.titulo}` : options.topico.replace(/^[A-Za-zÀ-ÿ]+:\s*/, ''));

    let welcomeContent = options.initialMessage;
    if (!welcomeContent) {
      if (materialItem) {
        const vocabHighlights = (materialItem.vocabulario || [])
          .slice(0, 3)
          .map((v) => `"${v.termo}"`)
          .join(', ');

        if (lang === 'Inglês') {
          welcomeContent = `Hello! Welcome to our focused conversation on "**${materialItem.titulo}**"! 🎯\n\nIn this lesson, we will explore key concepts${vocabHighlights ? ` like ${vocabHighlights}` : ''} and practice speaking naturally. How would you like to start: simulating a realistic dialogue, testing the main expressions, or discussing the central theme?`;
        } else if (lang === 'Espanhol') {
          welcomeContent = `¡Hola! Bienvenido a la sesión de conversación sobre "**${materialItem.titulo}**"! 🎯\n\nPracticaremos expresiones útiles${vocabHighlights ? ` como ${vocabHighlights}` : ''} y diálogo fluido. ¿Cómo te gustaría comenzar: practicando el diálogo o debatiendo el tema principal?`;
        } else if (lang === 'Francês') {
          welcomeContent = `Bonjour ! Bienvenue dans cette conversation dédiée à la leçon "**${materialItem.titulo}**" ! 🎯\n\nNous allons mettre en pratique les expressions clés${vocabHighlights ? ` comme ${vocabHighlights}` : ''}. Par quoi souhaitez-vous commencer ?`;
        } else {
          welcomeContent = `Olá! Bem-vindo à nossa sessão de conversação focada na lição "**${materialItem.titulo}**"! 🎯\n\nVamos praticar conversação fluida e aplicação real dos conceitos${vocabHighlights ? ` (${vocabHighlights})` : ''}. Como você prefere começar?`;
        }
      } else {
        const greetingsByLang: Record<string, string> = {
          'Inglês': `Hello! Starting a new conversation about **${options.topico}**. Let's practice speaking naturally! What would you like to explore first?`,
          'Espanhol': `¡Hola! Iniciando una nueva conversación sobre **${options.topico}**. ¿Qué aspecto te gustaría practicar primero?`,
          'Francês': `Bonjour ! Nouvelle conversation sur **${options.topico}**. Que souhaitez-vous aborder en premier ?`,
          'Alemão': `Hallo! Neue Konversation über **${options.topico}**. Worüber möchtest du sprechen?`,
          'Italiano': `Ciao! Nuova conversazione su **${options.topico}**. Di cosa vorresti parlare prima?`,
        };
        welcomeContent =
          greetingsByLang[lang] ||
          `Olá! Iniciando uma nova conversa sobre **${options.topico}**. O que você gostaria de praticar primeiro?`;
      }
    }

    const initialMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      remetente: 'tutor',
      conteudo: welcomeContent,
      timestamp: new Date().toISOString(),
      idioma: lang,
      conceitos_chave: materialItem ? materialItem.vocabulario?.slice(0, 4).map((v) => v.termo) : undefined,
    };

    const newConv: ChatConversation = {
      id: convId,
      titulo: convTitle,
      topico: options.topico,
      idioma: lang,
      material_id: options.materialId,
      material_titulo: options.materialTitulo || materialItem?.titulo,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
      mensagens: [initialMsg],
      nivel_cefr: cefr,
      total_mensagens: 1,
    };

    const all = this.getConversations();
    all.unshift(newConv);
    this.saveConversations(all);
    this.setActiveConversationId(convId);

    return newConv;
  },

  saveConversation(conv: ChatConversation) {
    const list = this.getConversations();
    const idx = list.findIndex((c) => c.id === conv.id);
    conv.atualizado_em = new Date().toISOString();
    conv.total_mensagens = conv.mensagens.length;
    if (idx >= 0) {
      list[idx] = conv;
    } else {
      list.unshift(conv);
    }
    this.saveConversations(list);
  },

  deleteConversation(id: string) {
    let list = this.getConversations().filter((c) => c.id !== id);
    if (list.length === 0) {
      const fallback = this.createConversation({
        titulo: 'Conversa Geral',
        topico: 'Conversação Geral',
      });
      list = [fallback];
    }
    this.saveConversations(list);
    if (this.getActiveConversationId() === id) {
      this.setActiveConversationId(list[0].id);
    }
  },

  // Retorna mensagens da conversa ativa ou legada
  getChatHistory(conversationId?: string): ChatMessage[] {
    const activeId = conversationId || this.getActiveConversationId();
    const conv = this.getConversation(activeId);
    if (conv) {
      return conv.mensagens;
    }
    return this.getLegacyChatHistory();
  },

  getLegacyChatHistory(): ChatMessage[] {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.CHATS));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  resetChatToStudyPlan(plan?: GeneratedStudyPlan) {
    const activePlan = plan || this.getStudyPlan();
    const stats = this.getStats();
    const lang = activePlan?.idioma || stats.idioma_ativo || 'Inglês';

    let initialContent = '';
    if (activePlan && activePlan.mensagem_boas_vindas_tutor) {
      initialContent = activePlan.mensagem_boas_vindas_tutor;
    } else {
      const greetingsByLang: Record<string, string> = {
        'Inglês':
          'Hello! Welcome to your Language Tutor. Estou aqui para destravar sua fala, corrigir vícios de tradução e falsos amigos, e praticar conversação no seu ritmo. Qual tópico vamos praticar hoje?',
        'Francês':
          'Bonjour ! Bienvenue à votre tuteur de français. Estou aqui para destravar sua conversação e pronúncia em francês. Vamos começar nossa prática?',
        'Espanhol':
          '¡Hola! Bienvenido a tu tutor de español. Estou aqui para ayudarte a hablar con fluidez y soltura. ¿Qué tema te gustaría practicar hoy?',
        'Alemão':
          'Hallo! Willkommen zu deinem Sprach-Tutor. Estou aqui para te ajudar com estruturas e conversação em alemão. Vamos começar?',
        'Italiano':
          'Ciao! Benvenuto al tuo tutor di italiano. Sono qui per aiutarti a parlare italiano con scioltezza e sicurezza. Cosa vorresti praticare oggi?',
        'Japonês':
          'Konnichiwa! (こんにちは!) Bem-vindo ao seu tutor de japonês. Estou pronto para praticar frases úteis e vocabulário com você. Vamos começar?',
      };
      initialContent =
        greetingsByLang[lang] ||
        `Olá! Bem-vindo ao seu tutor de ${lang}. Qual tópico ou situação prática vamos treinar hoje?`;
    }

    const initial: ChatMessage[] = [
      {
        id: `welcome-plan-${Date.now()}`,
        remetente: 'tutor',
        conteudo: initialContent,
        timestamp: new Date().toISOString(),
        idioma: lang,
        conceitos_chave: activePlan?.interesses_principais,
      },
    ];

    // Atualiza a conversa ativa
    const active = this.getActiveConversation();
    active.mensagens = initial;
    active.titulo = activePlan?.topico_inicial_recomendado ? `Plano: ${activePlan.topico_inicial_recomendado}` : 'Plano de Estudos';
    active.topico = activePlan?.topico_inicial_recomendado || `${lang}: Conversação Geral`;
    this.saveConversation(active);

    return initial;
  },

  saveChatHistory(messages: ChatMessage[], conversationId?: string) {
    const targetId = conversationId || this.getActiveConversationId();
    const conv = this.getConversation(targetId);
    if (conv) {
      conv.mensagens = messages;
      this.saveConversation(conv);
    } else {
      localStorage.setItem(this.getKey(STORAGE_KEYS.CHATS), JSON.stringify(messages));
    }
  },

  addChatMessage(msg: ChatMessage, conversationId?: string) {
    const targetId = conversationId || this.getActiveConversationId();
    const conv = this.getConversation(targetId);
    if (conv) {
      conv.mensagens.push(msg);
      this.saveConversation(conv);
    } else {
      const messages = this.getLegacyChatHistory();
      messages.push(msg);
      localStorage.setItem(this.getKey(STORAGE_KEYS.CHATS), JSON.stringify(messages));
    }
  },

  updateChatMessage(msgId: string, updates: Partial<ChatMessage>, conversationId?: string) {
    const targetId = conversationId || this.getActiveConversationId();
    const conv = this.getConversation(targetId);
    if (conv) {
      conv.mensagens = conv.mensagens.map((m) => (m.id === msgId ? { ...m, ...updates } : m));
      this.saveConversation(conv);
    } else {
      const messages = this.getLegacyChatHistory().map((m) => (m.id === msgId ? { ...m, ...updates } : m));
      localStorage.setItem(this.getKey(STORAGE_KEYS.CHATS), JSON.stringify(messages));
    }
  },

  clearChatHistory(conversationId?: string) {
    const targetId = conversationId || this.getActiveConversationId();
    const conv = this.getConversation(targetId);
    if (conv) {
      conv.mensagens = [];
      this.saveConversation(conv);
    } else {
      localStorage.setItem(this.getKey(STORAGE_KEYS.CHATS), JSON.stringify([]));
    }
  },

  // Estatísticas e Gamificação
  getStats(): UserStats {
    const today = new Date().toISOString().split('T')[0];
    const cleanDefaultStats: UserStats = {
      xp: 0,
      nivel: 1,
      sequencia_dias: 0,
      ultimo_dia_estudo: today,
      meta_diaria_minutos: 30,
      minutos_hoje: 0,
      conquistas_desbloqueadas: [],
      total_respostas: 0,
      respostas_corretas: 0,
      erros_corrigidos: 0,
      idioma_ativo: 'Inglês',
      nivel_cefr: 'A1',
      materiais_gerados: 0,
    };

    const parsed = readJsonCached<UserStats>(this.getKey(STORAGE_KEYS.STATS));
    if (!parsed) {
      this.saveStats(cleanDefaultStats, false);
      return cleanDefaultStats;
    }

    {
      if (parsed.ultimo_dia_estudo !== today) {
        const last = new Date(parsed.ultimo_dia_estudo || today);
        const curr = new Date(today);
        const diffDays = Math.floor((curr.getTime() - last.getTime()) / 86400000);
        if (diffDays === 1) {
          parsed.sequencia_dias += 1;
        } else if (diffDays > 2) {
          parsed.sequencia_dias = 0;
        }
        parsed.ultimo_dia_estudo = today;
        parsed.minutos_hoje = 0;
        this.saveStats(parsed);
      }
      return parsed;
    }
  },

  saveStats(stats: UserStats, sync = true) {
    localStorage.setItem(this.getKey(STORAGE_KEYS.STATS), JSON.stringify(stats));
    // Registra a mutação local (carimbo) para a decisão de sync por carimbo.
    this.touchLocalSyncStamp('stats');
    if (sync) this.scheduleCloudSync();
  },

  addXP(amount: number): { stats: UserStats; subiu_nivel: boolean; novo_nivel: number } {
    const stats = this.getStats();
    stats.xp += amount;

    // Nível = floor(sqrt(xp / 80)) + 1
    const novoNivel = Math.floor(Math.sqrt(stats.xp / 80)) + 1;
    const subiuNivel = novoNivel > stats.nivel;
    stats.nivel = novoNivel;

    this.saveStats(stats);
    return { stats, subiu_nivel: subiuNivel, novo_nivel: novoNivel };
  },

  recordAnswer(correta: boolean, activity?: { topico?: string; xp?: number }) {
    const stats = this.getStats();
    stats.total_respostas += 1;
    if (correta) {
      stats.respostas_corretas += 1;
    }
    this.saveStats(stats);

    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const sessionId = `activity-${date}`;
    const sessions = this.getSessions();
    const existing = sessions.find((session) => session.id === sessionId);

    if (existing) {
      existing.fim = now.toISOString();
      existing.respostas_totais += 1;
      existing.respostas_corretas += correta ? 1 : 0;
      existing.erros_identificados += correta ? 0 : 1;
      existing.xp_obtido += Math.max(0, activity?.xp ?? 0);
      if (activity?.topico && !existing.conceitos_trabalhados.includes(activity.topico)) {
        existing.conceitos_trabalhados.push(activity.topico);
      }
      this.saveSessions(sessions);
      return;
    }

    this.addSession({
      id: sessionId,
      titulo: 'Prática registrada',
      topico: activity?.topico || 'Prática com o tutor',
      inicio: now.toISOString(),
      fim: now.toISOString(),
      duracao_minutos: 0,
      respostas_totais: 1,
      respostas_corretas: correta ? 1 : 0,
      conceitos_trabalhados: activity?.topico ? [activity.topico] : [],
      erros_identificados: correta ? 0 : 1,
      xp_obtido: Math.max(0, activity?.xp ?? 0),
      concluida: true,
    });
  },

  recordMinutesStudied(minutos: number) {
    const stats = this.getStats();
    stats.minutos_hoje += minutos;
    this.saveStats(stats);
  },

  // Conquistas
  getAchievements(): Achievement[] {
    const parsed = readJsonCached<Achievement[]>(this.getKey(STORAGE_KEYS.ACHIEVEMENTS));
    if (parsed) return parsed;
    this.saveAchievements(DEFAULT_ACHIEVEMENTS);
    return [...DEFAULT_ACHIEVEMENTS];
  },

  saveAchievements(achievements: Achievement[]) {
    writeJsonCached(this.getKey(STORAGE_KEYS.ACHIEVEMENTS), achievements);
  },

  unlockAchievement(id: string): Achievement | null {
    const list = this.getAchievements();
    const item = list.find((a) => a.id === id);
    if (item && !item.desbloqueada) {
      item.desbloqueada = true;
      item.data_desbloqueio = new Date().toISOString();
      this.saveAchievements(list);
      this.addXP(item.xp_recompensa);
      return item;
    }
    return null;
  },

  // Sessões
  getSessions(): StudySession[] {
    return readJsonCached<StudySession[]>(this.getKey(STORAGE_KEYS.SESSIONS)) ?? [];
  },

  saveSessions(sessions: StudySession[]) {
    writeJsonCached(this.getKey(STORAGE_KEYS.SESSIONS), sessions);
  },

  addSession(session: StudySession) {
    const list = this.getSessions();
    list.unshift(session);
    this.saveSessions(list);
  },

  // Documentos de Sincronização NotebookLM (compatibilidade)
  getNotebookLMDocs(): NotebookLMSyncDoc[] {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.NOTEBOOKLM));
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveNotebookLMDocs(docs: NotebookLMSyncDoc[]) {
    localStorage.setItem(this.getKey(STORAGE_KEYS.NOTEBOOKLM), JSON.stringify(docs));
  },

  saveOrUpdateNotebookDoc(doc: NotebookLMSyncDoc) {
    const docs = this.getNotebookLMDocs();
    const idx = docs.findIndex((d) => d.id === doc.id);
    if (idx >= 0) {
      docs[idx] = doc;
    } else {
      docs.unshift(doc);
    }
    this.saveNotebookLMDocs(docs);
  },

  // Lembretes de Prática e Notificações Locais
  getReminders(): PracticeReminder[] {
    const raw = localStorage.getItem(this.getKey(STORAGE_KEYS.REMINDERS));
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveReminders(reminders: PracticeReminder[]) {
    localStorage.setItem(this.getKey(STORAGE_KEYS.REMINDERS), JSON.stringify(reminders));
  },

  addReminder(reminder: PracticeReminder) {
    const list = this.getReminders();
    list.unshift(reminder);
    this.saveReminders(list);
  },

  updateReminder(reminder: PracticeReminder) {
    const list = this.getReminders();
    const idx = list.findIndex((r) => r.id === reminder.id);
    if (idx >= 0) {
      list[idx] = reminder;
      this.saveReminders(list);
    }
  },

  deleteReminder(id: string) {
    const list = this.getReminders();
    const updated = list.filter((r) => r.id !== id);
    this.saveReminders(updated);
  },

  toggleReminder(id: string) {
    const list = this.getReminders();
    const item = list.find((r) => r.id === id);
    if (item) {
      item.ativo = !item.ativo;
      this.saveReminders(list);
    }
  },

  // Exportação e Importação de Pacotes de Conhecimento
  exportCurrentKnowledgeBase(
    titulo: string,
    descricao: string,
    idioma = 'Inglês',
    autorNome = 'Professor'
  ): SharedKnowledgePack {
    const nodes = this.getNodes();
    const relations = this.getRelations();
    const materials = this.getMaterials();

    return {
      id: `pack-${Date.now()}`,
      titulo: titulo || 'Base de Conhecimento Personalizada',
      descricao: descricao || 'Vocabulário e materiais de estudo selecionados.',
      idioma: idioma,
      nivel_cefr: 'B1',
      autor_nome: autorNome,
      autor_id: _currentUserId,
      publicado_em: new Date().toISOString(),
      total_termos: nodes.length,
      total_materiais: materials.length,
      dados_pack: {
        nodes,
        relations,
        materials,
      },
    };
  },

  importKnowledgePack(pack: SharedKnowledgePack): { addedNodes: number; addedMaterials: number } {
    let addedNodes = 0;
    let addedMaterials = 0;

    if (pack.dados_pack?.nodes && pack.dados_pack.nodes.length > 0) {
      const currentNodes = this.getNodes();
      pack.dados_pack.nodes.forEach((n) => {
        const exists = currentNodes.some((cn) => cn.titulo.toLowerCase() === n.titulo.toLowerCase());
        if (!exists) {
          currentNodes.push({
            ...n,
            id: `node-imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            criado_em: new Date().toISOString(),
          });
          addedNodes++;
        }
      });
      this.saveNodes(currentNodes);
    }

    if (pack.dados_pack?.materials && pack.dados_pack.materials.length > 0) {
      const currentMaterials = this.getMaterials();
      pack.dados_pack.materials.forEach((m) => {
        const exists = currentMaterials.some((cm) => cm.titulo.toLowerCase() === m.titulo.toLowerCase());
        if (!exists) {
          currentMaterials.unshift({
            ...m,
            id: `mat-imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            criado_em: new Date().toISOString(),
          });
          addedMaterials++;
        }
      });
      this.saveMaterials(currentMaterials);
    }

    if (pack.dados_pack?.relations && pack.dados_pack.relations.length > 0) {
      const currentRelations = this.getRelations();
      pack.dados_pack.relations.forEach((r) => {
        currentRelations.push({
          ...r,
          id: `rel-imported-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
      });
      this.saveRelations(currentRelations);
    }

    return { addedNodes, addedMaterials };
  },

  // Reset completo para a base do usuário atual (Zera tudo para começar do zero)
  resetAllData() {
    localStorage.removeItem(this.getKey(STORAGE_KEYS.NODES));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.RELATIONS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.CORRECTIONS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.CHATS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.CONVERSATIONS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.ACTIVE_CONVERSATION_ID));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.STATS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.ACHIEVEMENTS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.SESSIONS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.MATERIALS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.NOTEBOOKLM));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.REMINDERS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.SETTINGS));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.ONBOARDING_PLAN));
    localStorage.removeItem(this.getKey(STORAGE_KEYS.ONBOARDING_COMPLETED));
  },

  resetToDefaults() {
    this.resetAllData();
  },

  // Carrega dados de demonstração apenas se o usuário solicitar explicitamente
  loadSampleData() {
    this.saveMaterials(SEED_MATERIALS, false);
    this.saveNodes(SEED_NODES, false);
    this.saveRelations(SEED_RELATIONS, false);
    this.saveCorrections(SEED_CORRECTIONS, false);
    this.saveSessions(SEED_SESSIONS);
  },

  setDailyGoal(minutes: number): UserStats {
    const stats = this.getStats();
    stats.meta_diaria_minutos = minutes;
    this.saveStats(stats);
    return stats;
  },

  // Suporte ao Assistente de Configuração (Onboarding) e Plano de Estudos
  hasCompletedOnboarding(): boolean {
    const val = localStorage.getItem(this.getKey(STORAGE_KEYS.ONBOARDING_COMPLETED));
    return val === 'true';
  },

  setOnboardingCompleted(completed: boolean = true) {
    localStorage.setItem(this.getKey(STORAGE_KEYS.ONBOARDING_COMPLETED), completed ? 'true' : 'false');
  },

  getStudyPlan(): GeneratedStudyPlan | null {
    return readJsonCached<GeneratedStudyPlan>(this.getKey(STORAGE_KEYS.ONBOARDING_PLAN));
  },

  saveStudyPlan(plan: GeneratedStudyPlan) {
    writeJsonCached(this.getKey(STORAGE_KEYS.ONBOARDING_PLAN), plan);
  },

  /**
   * Aplica o Plano de Estudos Gerado em todo o ecossistema (Grafo, Materiais, Stats, Lembretes)
   */
  applyGeneratedPlan(plan: GeneratedStudyPlan): {
    nodesAdded: number;
    materialAdded: boolean;
    newStats: UserStats;
  } {
    // 1. Salva o plano como ativo
    this.saveStudyPlan(plan);
    this.setOnboardingCompleted(true);

    // 2. Atualiza stats de idioma, nível e meta diária
    const stats = this.getStats();
    stats.idioma_ativo = plan.idioma;
    stats.nivel_cefr = plan.nivel_cefr;
    stats.meta_diaria_minutos = plan.meta_diaria_minutos ?? 30;
    this.saveStats(stats);

    // 3. Adiciona nós iniciais ao Grafo de Conhecimento
    let nodesAdded = 0;
    if (plan.nos_iniciais_grafo && plan.nos_iniciais_grafo.length > 0) {
      const currentNodes = this.getNodes();
      plan.nos_iniciais_grafo.forEach((newNode) => {
        if (!newNode.titulo) return;
        const exists = currentNodes.some(
          (cn) => cn.titulo.toLowerCase() === (newNode.titulo || '').toLowerCase()
        );
        if (!exists) {
          const fullNode: GraphNode = {
            id: newNode.id || `node-plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tipo: (newNode.tipo || 'vocabulario') as any,
            titulo: newNode.titulo,
            descricao: newNode.descricao || '',
            dominio_estimado: newNode.dominio_estimado ?? 0,
            dificuldade: newNode.dificuldade ?? 2,
            frequencia_erro: newNode.frequencia_erro ?? 0,
            ultima_revisao: new Date().toISOString(),
            proxima_revisao: new Date(Date.now() + 86400000).toISOString(),
            idioma: plan.idioma,
            pronuncia_ipa: newNode.pronuncia_ipa,
            traducao: newNode.traducao,
            exemplo_uso: newNode.exemplo_uso,
            evidencias: [PLAN_NODE_EVIDENCE],
            criado_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
          };
          currentNodes.push(fullNode);
          nodesAdded++;
        }
      });
      this.saveNodes(currentNodes);
    }

    // 4. Adiciona o Primeiro Material de Estudo
    let materialAdded = false;
    if (plan.primeiro_material_estudo) {
      const currentMaterials = this.getMaterials();
      const exists = currentMaterials.some(
        (m) => m.titulo.toLowerCase() === plan.primeiro_material_estudo.titulo.toLowerCase()
      );
      if (!exists) {
        currentMaterials.unshift(plan.primeiro_material_estudo);
        this.saveMaterials(currentMaterials);
        materialAdded = true;
      }
    }

    // 5. Configura um lembrete diário baseado no plano
    const currentReminders = this.getReminders();
    const hasPlanReminder = currentReminders.some((r) => r.topico === plan.topico_inicial_recomendado);
    if (!hasPlanReminder) {
      this.addReminder({
        id: `rem-plan-${Date.now()}`,
        titulo: `Prática de ${plan.idioma} (${plan.meta_diaria_minutos} min)`,
        topico: plan.topico_inicial_recomendado,
        horario: '19:00',
        dias_semana: [1, 2, 3, 4, 5],
        ativo: true,
        tipo_notificacao: 'browser',
        antecedencia_minutos: 10,
        criado_em: new Date().toISOString(),
      });
    }

    // 6. Inicializa o Chat do Tutor 100% calibrado com o plano de estudos gerado
    this.resetChatToStudyPlan(plan);

    return {
      nodesAdded,
      materialAdded,
      newStats: stats,
    };
  },
};
