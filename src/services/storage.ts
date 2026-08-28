import {
  GraphNode,
  GraphRelation,
  PedagogicalCorrection,
  ChatMessage,
  UserStats,
  Achievement,
  StudySession,
  StudyMaterialItem,
  NotebookLMSyncDoc,
  PracticeReminder,
} from '../types';

const STORAGE_KEYS = {
  NODES: 'tutor_graph_nodes_v1',
  RELATIONS: 'tutor_graph_relations_v1',
  CORRECTIONS: 'tutor_corrections_v1',
  CHATS: 'tutor_chat_history_v1',
  STATS: 'tutor_user_stats_v1',
  ACHIEVEMENTS: 'tutor_achievements_v1',
  SESSIONS: 'tutor_sessions_v1',
  MATERIALS: 'tutor_study_materials_v1',
  NOTEBOOKLM: 'tutor_notebooklm_docs_v1',
  REMINDERS: 'tutor_practice_reminders_v1',
  SETTINGS: 'tutor_settings_v1',
};

// Conquistas Iniciais Personalizadas para Tutor de Línguas
export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'primeira_conversa',
    titulo: 'Primeira Palavra',
    descricao: 'Iniciou sua primeira sessão de conversação e imersão com o tutor de línguas.',
    icone: 'Sparkles',
    xp_recompensa: 50,
    desbloqueada: true,
    data_desbloqueio: new Date().toISOString(),
    progresso_atual: 1,
    progresso_meta: 1,
    categoria: 'consistencia',
  },
  {
    id: 'mestre_conceitos_dificeis',
    titulo: 'Mestre da Fluência',
    descricao: 'Alcançou domínio de 80% ou mais em uma estrutura gramatical ou vocabulário avançado no grafo.',
    icone: 'Award',
    xp_recompensa: 250,
    desbloqueada: false,
    progresso_atual: 75,
    progresso_meta: 80,
    categoria: 'dominio',
  },
  {
    id: 'maratonista_estudos',
    titulo: 'Maratonista de Idiomas',
    descricao: 'Manteve uma sequência de pelo menos 3 dias consecutivos de imersão e prática diária.',
    icone: 'Flame',
    xp_recompensa: 200,
    desbloqueada: true,
    data_desbloqueio: new Date().toISOString(),
    progresso_atual: 3,
    progresso_meta: 3,
    categoria: 'consistencia',
  },
  {
    id: 'detetive_erros',
    titulo: 'Caçador de Falsos Amigos',
    descricao: 'Identificou, corrigiu e consolidou 3 ou mais falsos cognatos ou vícios de tradução literal.',
    icone: 'CheckCircle2',
    xp_recompensa: 180,
    desbloqueada: false,
    progresso_atual: 2,
    progresso_meta: 3,
    categoria: 'correcao',
  },
  {
    id: 'arquiteto_saber',
    titulo: 'Léxico Vivo',
    descricao: 'Mapeou e conectou 5 ou mais termos de vocabulário e regras no Grafo de Memória.',
    icone: 'Network',
    xp_recompensa: 220,
    desbloqueada: true,
    data_desbloqueio: new Date().toISOString(),
    progresso_atual: 5,
    progresso_meta: 5,
    categoria: 'grafo',
  },
  {
    id: 'voz_sabedoria',
    titulo: 'Voz da Fluência',
    descricao: 'Praticou conversação oral em tempo real com o Gemini Live API ou gravou transcrições faladas.',
    icone: 'Mic',
    xp_recompensa: 150,
    desbloqueada: false,
    progresso_atual: 1,
    progresso_meta: 2,
    categoria: 'voz',
  },
  {
    id: 'memoria_blindada',
    titulo: 'Memória de Longo Prazo',
    descricao: 'Concluiu revisões espaçadas de cartões e vocabulário antes da expiração da retenção.',
    icone: 'Brain',
    xp_recompensa: 160,
    desbloqueada: false,
    progresso_atual: 1,
    progresso_meta: 2,
    categoria: 'dominio',
  },
  {
    id: 'criador_materiais',
    titulo: 'Estúdio de Materiais',
    descricao: 'Transformou vídeos do YouTube ou textos em kits de estudos completos com vocabulário e diálogos.',
    icone: 'BookOpen',
    xp_recompensa: 150,
    desbloqueada: true,
    data_desbloqueio: new Date().toISOString(),
    progresso_atual: 1,
    progresso_meta: 1,
    categoria: 'materiais',
  },
];

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

export const StorageService = {
  // Materiais de Estudo (YouTube, Textos, Arquivos)
  getMaterials(): StudyMaterialItem[] {
    const raw = localStorage.getItem(STORAGE_KEYS.MATERIALS);
    if (!raw) {
      this.saveMaterials(SEED_MATERIALS);
      return SEED_MATERIALS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_MATERIALS;
    }
  },

  saveMaterials(materials: StudyMaterialItem[]) {
    localStorage.setItem(STORAGE_KEYS.MATERIALS, JSON.stringify(materials));
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
    const raw = localStorage.getItem(STORAGE_KEYS.NODES);
    if (!raw) {
      this.saveNodes(SEED_NODES);
      return SEED_NODES;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_NODES;
    }
  },

  saveNodes(nodes: GraphNode[]) {
    localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
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
    const raw = localStorage.getItem(STORAGE_KEYS.RELATIONS);
    if (!raw) {
      this.saveRelations(SEED_RELATIONS);
      return SEED_RELATIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_RELATIONS;
    }
  },

  saveRelations(relations: GraphRelation[]) {
    localStorage.setItem(STORAGE_KEYS.RELATIONS, JSON.stringify(relations));
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
    const raw = localStorage.getItem(STORAGE_KEYS.CORRECTIONS);
    if (!raw) {
      this.saveCorrections(SEED_CORRECTIONS);
      return SEED_CORRECTIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_CORRECTIONS;
    }
  },

  saveCorrections(corrections: PedagogicalCorrection[]) {
    localStorage.setItem(STORAGE_KEYS.CORRECTIONS, JSON.stringify(corrections));
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

  // Histórico de Chat
  getChatHistory(): ChatMessage[] {
    const raw = localStorage.getItem(STORAGE_KEYS.CHATS);
    if (!raw) {
      const initial: ChatMessage[] = [
        {
          id: 'welcome-msg',
          remetente: 'tutor',
          conteudo:
            'Hello! Welcome to your Language Tutor. Estou aqui para destravar sua fala, corrigir vícios de tradução e falsos amigos, e praticar conversação no seu ritmo. Qual idioma e tópico vamos praticar hoje?',
          timestamp: new Date().toISOString(),
          idioma: 'Inglês',
        },
      ];
      this.saveChatHistory(initial);
      return initial;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveChatHistory(messages: ChatMessage[]) {
    localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(messages));
  },

  addChatMessage(msg: ChatMessage) {
    const messages = this.getChatHistory();
    messages.push(msg);
    this.saveChatHistory(messages);
  },

  updateChatMessage(msgId: string, updates: Partial<ChatMessage>) {
    const messages = this.getChatHistory().map((m) =>
      m.id === msgId ? { ...m, ...updates } : m
    );
    this.saveChatHistory(messages);
  },

  clearChatHistory() {
    this.saveChatHistory([]);
  },

  // Estatísticas e Gamificação
  getStats(): UserStats {
    const raw = localStorage.getItem(STORAGE_KEYS.STATS);
    const today = new Date().toISOString().split('T')[0];
    const defaultStats: UserStats = {
      xp: 420,
      nivel: 2,
      sequencia_dias: 3,
      ultimo_dia_estudo: today,
      meta_diaria_minutos: 30,
      minutos_hoje: 20,
      conquistas_desbloqueadas: ['primeira_conversa', 'arquiteto_saber', 'criador_materiais'],
      total_respostas: 16,
      respostas_corretas: 13,
      erros_corrigidos: 3,
      idioma_ativo: 'Inglês',
      nivel_cefr: 'B1',
      materiais_gerados: 1,
    };

    if (!raw) {
      this.saveStats(defaultStats);
      return defaultStats;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.ultimo_dia_estudo !== today) {
        const last = new Date(parsed.ultimo_dia_estudo || today);
        const curr = new Date(today);
        const diffDays = Math.floor((curr.getTime() - last.getTime()) / 86400000);
        if (diffDays === 1) {
          parsed.sequencia_dias += 1;
        } else if (diffDays > 2) {
          parsed.sequencia_dias = 1;
        }
        parsed.ultimo_dia_estudo = today;
        parsed.minutos_hoje = 0;
        this.saveStats(parsed);
      }
      return parsed;
    } catch {
      return defaultStats;
    }
  },

  saveStats(stats: UserStats) {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
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

  recordAnswer(correta: boolean) {
    const stats = this.getStats();
    stats.total_respostas += 1;
    if (correta) {
      stats.respostas_corretas += 1;
    }
    this.saveStats(stats);
  },

  recordMinutesStudied(minutos: number) {
    const stats = this.getStats();
    stats.minutos_hoje += minutos;
    this.saveStats(stats);
  },

  // Conquistas
  getAchievements(): Achievement[] {
    const raw = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    if (!raw) {
      this.saveAchievements(DEFAULT_ACHIEVEMENTS);
      return DEFAULT_ACHIEVEMENTS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return DEFAULT_ACHIEVEMENTS;
    }
  },

  saveAchievements(achievements: Achievement[]) {
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify(achievements));
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
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!raw) {
      this.saveSessions(SEED_SESSIONS);
      return SEED_SESSIONS;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return SEED_SESSIONS;
    }
  },

  saveSessions(sessions: StudySession[]) {
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  addSession(session: StudySession) {
    const list = this.getSessions();
    list.unshift(session);
    this.saveSessions(list);
  },

  // Documentos de Sincronização NotebookLM (compatibilidade)
  getNotebookLMDocs(): NotebookLMSyncDoc[] {
    const raw = localStorage.getItem(STORAGE_KEYS.NOTEBOOKLM);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveNotebookLMDocs(docs: NotebookLMSyncDoc[]) {
    localStorage.setItem(STORAGE_KEYS.NOTEBOOKLM, JSON.stringify(docs));
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
    const raw = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    if (!raw) {
      const defaultReminders: PracticeReminder[] = [
        {
          id: 'rem-1',
          titulo: 'Prática Noturna de Conversação & Fluência',
          topico: 'Connected Speech & Pronúncia',
          horario: '19:00',
          dias_semana: [1, 2, 3, 4, 5], // Seg a Sex
          ativo: true,
          tipo_notificacao: 'browser',
          antecedencia_minutos: 5,
          criado_em: new Date().toISOString(),
        },
        {
          id: 'rem-2',
          titulo: 'Revisão Espaçada de Vocabulário & Cartões',
          topico: 'Vocabulário & Phrasal Verbs',
          horario: '08:30',
          dias_semana: [0, 1, 2, 3, 4, 5, 6], // Todos os dias
          ativo: true,
          tipo_notificacao: 'browser',
          antecedencia_minutos: 10,
          criado_em: new Date().toISOString(),
        },
      ];
      this.saveReminders(defaultReminders);
      return defaultReminders;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  saveReminders(reminders: PracticeReminder[]) {
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(reminders));
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

  // Reset completo
  resetAllData() {
    localStorage.removeItem(STORAGE_KEYS.NODES);
    localStorage.removeItem(STORAGE_KEYS.RELATIONS);
    localStorage.removeItem(STORAGE_KEYS.CORRECTIONS);
    localStorage.removeItem(STORAGE_KEYS.CHATS);
    localStorage.removeItem(STORAGE_KEYS.STATS);
    localStorage.removeItem(STORAGE_KEYS.ACHIEVEMENTS);
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.MATERIALS);
    localStorage.removeItem(STORAGE_KEYS.NOTEBOOKLM);
    localStorage.removeItem(STORAGE_KEYS.REMINDERS);
  },

  resetToDefaults() {
    this.resetAllData();
  },

  setDailyGoal(minutes: number): UserStats {
    const stats = this.getStats();
    stats.meta_diaria_minutos = minutes;
    this.saveStats(stats);
    return stats;
  },
};
