export type NodeType =
  | 'topico'
  | 'conceito'
  | 'vocabulario'
  | 'gramatica'
  | 'falso_amigo'
  | 'expressao_idiomatica'
  | 'dificuldade'
  | 'equivoco'
  | 'objetivo_aprendizagem'
  | 'anotacao';

export type RelationType =
  | 'relacionado_a'
  | 'pre_requisito_de'
  | 'confundido_com'
  | 'dificuldade_em'
  | 'evidenciado_por'
  | 'sinonimo_de'
  | 'antonymo_de'
  | 'derivado_de';

export type CorrectionSeverity = 'leve' | 'moderada' | 'critica';
export type CorrectionStatus = 'pendente' | 'compreendido' | 'precisa_revisar';

export type AdaptationLevel =
  | 'fundamental_analogico'
  | 'intermediario_aplicado'
  | 'avancado_analitico';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface ExplanationAdaptation {
  nivel: AdaptationLevel;
  rotulo: string; // Ex: "A1/A2 - Básico com Analogias", "B1/B2 - Intermediário Aplicado", "C1/C2 - Avançado e Idiomático"
  dominio_avaliado: number; // 0 a 100%
  justificativa: string; // Por que essa adaptação foi escolhida com base no grafo de idiomas
  estrategia_pedagogica: string;
  conceitos_relacionados?: string[];
}

export interface GraphNode {
  id: string;
  tipo: NodeType;
  titulo: string;
  descricao: string;
  dominio_estimado: number; // 0 a 100
  dificuldade: number; // 1 a 5
  frequencia_erro: number;
  ultima_revisao: string; // ISO date
  proxima_revisao: string; // ISO date
  topico_pai?: string;
  evidencias: string[];
  criado_em: string;
  atualizado_em: string;
  nivel_adaptacao_recente?: string;
  idioma?: string;
  pronuncia_ipa?: string;
  traducao?: string;
  exemplo_uso?: string;
}

export interface GraphRelation {
  id: string;
  origem_id: string;
  destino_id: string;
  tipo: RelationType;
  peso: number; // 0.1 a 1.0
  descricao?: string;
  evidencia?: string;
  criado_em: string;
}

export interface PedagogicalCorrection {
  id: string;
  conceito: string;
  erro: string;
  explicacao: string;
  resposta_corrigida: string;
  gravidade: CorrectionSeverity;
  data: string; // ISO
  evidencia: string;
  estado_posterior: CorrectionStatus;
  pergunta_confirmacao?: string;
  respondido_corretamente?: boolean;
  dica_pronuncia_ou_gramatica?: string;
}

export type SpeechRatePacing =
  | 'muito_lento'
  | 'lento'
  | 'ideal'
  | 'rapido'
  | 'muito_rapido';

export interface SpeechRateMetrics {
  wpm: number; // Palavras por minuto
  wordsCount: number;
  durationSeconds: number;
  pacing: SpeechRatePacing;
  targetMinWpm: number;
  targetMaxWpm: number;
  cefrLevel: CEFRLevel;
  feedbackText: string;
  pacingTip: string;
  percentageOfTarget: number; // 0% a 200%
}

export interface PhonemeAccuracy {
  word: string;
  expected_ipa: string;
  transcribed_ipa: string;
  accuracy: number; // 0 a 100
  status: 'perfeito' | 'bom' | 'atencao' | 'incorreto';
  feedback?: string;
}

export interface PronunciationScoreData {
  overall_score: number; // 0 a 100
  accuracy_score: number; // 0 a 100
  fluency_score: number; // 0 a 100
  prosody_score: number; // 0 a 100
  completeness_score: number; // 0 a 100
  recognized_text: string;
  expected_phonetics_ipa: string;
  transcribed_phonetics_ipa: string;
  words_breakdown: PhonemeAccuracy[];
  ponto_forte: string;
  ponto_a_melhorar: string;
  dica_articulacao_boca: string;
  audio_duration_seconds?: number;
  speech_rate?: SpeechRateMetrics;
}

export interface ChatMessage {
  id: string;
  remetente: 'user' | 'tutor' | 'system';
  conteudo: string;
  timestamp: string;
  correcao?: PedagogicalCorrection;
  conceitos_chave?: string[];
  novos_nos_grafo?: Partial<GraphNode>[];
  audio_url?: string;
  xp_ganho?: number;
  adaptacao?: ExplanationAdaptation;
  idioma?: string;
  pronunciation_score?: PronunciationScoreData;
  speech_rate?: SpeechRateMetrics;
  is_audio_response?: boolean;
}

export interface ChatConversation {
  id: string;
  titulo: string;
  topico: string;
  idioma: string;
  material_id?: string; // id da lição / material vinculado
  material_titulo?: string;
  criado_em: string;
  atualizado_em: string;
  mensagens: ChatMessage[];
  nivel_cefr?: CEFRLevel;
  total_mensagens?: number;
}

export interface UserStats {
  xp: number;
  nivel: number;
  sequencia_dias: number;
  ultimo_dia_estudo: string; // YYYY-MM-DD
  meta_diaria_minutos: number;
  minutos_hoje: number;
  conquistas_desbloqueadas: string[];
  total_respostas: number;
  respostas_corretas: number;
  erros_corrigidos: number;
  sessoes_voz_realizadas?: number;
  idioma_ativo?: string;
  nivel_cefr?: CEFRLevel;
  materiais_gerados?: number;
}

export interface Achievement {
  id: string;
  titulo: string;
  descricao: string;
  icone: string;
  xp_recompensa: number;
  desbloqueada: boolean;
  data_desbloqueio?: string;
  progresso_atual?: number;
  progresso_meta?: number;
  categoria?: 'dominio' | 'consistencia' | 'correcao' | 'grafo' | 'voz' | 'materiais';
}

export interface StudySession {
  id: string;
  titulo: string;
  topico: string;
  inicio: string; // ISO
  fim?: string; // ISO
  duracao_minutos: number;
  respostas_totais: number;
  respostas_corretas: number;
  conceitos_trabalhados: string[];
  erros_identificados: number;
  xp_obtido: number;
  concluida: boolean;
  calendar_event_id?: string;
}

export interface PriorityTopicSuggestion {
  id: string;
  titulo: string;
  motivo_prioridade: string;
  descricao_pedagogica: string;
  dominio_atual: number; // 0 a 100
  frequencia_erro: number;
  dificuldade: number; // 1 a 5
  tipo_no: NodeType;
  estrategia_sugerida: string;
  nivel_urgencia: 'critica' | 'alta' | 'moderada';
  nos_relacionados?: string[];
  exemplos_praticos?: string[];
}

export interface WeeklyMetrics {
  periodo: {
    inicio: string;
    fim: string;
  };
  sessoes_realizadas: number;
  minutos_estudados: number;
  total_respostas: number;
  respostas_corretas: number;
  taxa_acerto: number; // 0 a 100
  erros_corrigidos: number;
  erros_recorrentes: number;
  xp_ganho: number;
  sequencia_atual: number;
  metas_dias_concluidas: number;
  topicos_dificeis: {
    topico: string;
    erros: number;
    dominio_medio: number;
  }[];
  evolucao_dominio: {
    topico: string;
    dominio_inicial: number;
    dominio_atual: number;
  }[];
  revisoes_pendentes: number;
  comparativo_semana_anterior: {
    minutos_delta_pct: number;
    taxa_acerto_delta_pct: number;
    xp_delta_pct: number;
  };
  recomendacao_objetiva: string;
}

export interface DailyGoal {
  id: string;
  titulo: string;
  descricao: string;
  categoria: 'tempo' | 'precisao' | 'revisao' | 'conversacao';
  progresso_atual: number;
  meta_total: number;
  unidade: string;
  concluida: boolean;
  xp_recompensa: number;
  icone: string;
}

export interface MilestoneItem {
  id: string;
  titulo: string;
  descricao: string;
  nivel: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante';
  progresso_atual: number;
  meta_total: number;
  unidade: string;
  concluida: boolean;
  xp_recompensa: number;
  data_conquista?: string;
  categoria: 'streak' | 'mastery' | 'fluency' | 'accuracy';
}

export interface CalendarEventProposal {
  id: string;
  titulo: string;
  descricao: string;
  inicio: string; // ISO
  fim: string; // ISO
  duracao_minutos: number;
  topicos: string[];
  prioridade: 'alta' | 'media' | 'baixa';
  tipo: 'revisao_espacada' | 'novo_conceito' | 'correcao_erros';
}

export interface PracticeReminder {
  id: string;
  titulo: string;
  topico?: string;
  horario: string; // "19:00"
  dias_semana: number[]; // 0=Domingo, 1=Segunda, ..., 6=Sábado
  ativo: boolean;
  tipo_notificacao: 'browser' | 'som' | 'visual';
  antecedencia_minutos: number; // 0, 5, 10, 15, 30
  criado_em: string;
  ultimo_disparo?: string;
  origem_sessao_id?: string;
}

export interface PronunciationChallenge {
  id: string;
  frase: string;
  pronuncia_ipa: string;
  traducao: string;
  dificuldade: 'facil' | 'medio' | 'dificil';
  dica_articulacao: string;
  foco_fonetico: string;
}

// NOVO: Estrutura do Estúdio de MATERIAIS de Estudo
export interface VocabularyItem {
  termo: string;
  pronuncia_ipa?: string;
  traducao: string;
  classe_gramatical?: string;
  exemplo: string;
  traducao_exemplo?: string;
  nivel?: string;
}

export interface GrammarItem {
  topico: string;
  explicacao: string;
  exemplos: string[];
  dica_para_brasileiros?: string;
}

export interface DialogueLine {
  personagem: string;
  fala: string;
  traducao?: string;
  audio_tip?: string;
}

export interface ComprehensionQuestion {
  id?: string;
  pergunta: string;
  opcoes?: string[];
  resposta_correta: string;
  explicacao: string;
}

export interface FlashcardItem {
  id?: string;
  frente: string;
  verso: string;
  dica?: string;
}

export interface StudyMaterialItem {
  id: string;
  titulo: string;
  tipo_fonte: 'youtube' | 'texto' | 'arquivo';
  fonte_original: string;
  youtube_video_id?: string;
  idioma_alvo: string;
  nivel_cefr: string;
  resumo: string;
  vocabulario: VocabularyItem[];
  gramatica: GrammarItem[];
  dialogo_pratica: DialogueLine[];
  questoes_compreensao: ComprehensionQuestion[];
  flashcards: FlashcardItem[];
  dicas_culturais_e_pronuncia?: string[];
  conteudo_markdown: string;
  criado_em: string;
  adicionado_ao_grafo: boolean;
}

// Mantido para compatibilidade se necessário
export interface NotebookLMSyncDoc {
  id: string;
  titulo: string;
  ultima_sincronizacao: string;
  google_doc_id?: string;
  google_doc_url?: string;
  conteudo_markdown: string;
  total_topicos: number;
  total_conceitos: number;
  total_anotacoes: number;
}

// Tipos para o Sistema de Tematização Dinâmica de Idiomas
export type LanguageThemeId = 'ingles' | 'espanhol' | 'frances' | 'alemao' | 'italiano' | 'japones';

export interface LanguageThemeConfig {
  id: LanguageThemeId;
  nome: string;
  bandeira: string;
  codigo_voz: string;
  slogan: string;
  cor_primaria: string;
  badge_class: string;
  bg_gradient: string;
  card_accent: string;
  border_accent: string;
  button_class: string;
  ring_class: string;
  texto_destaque: string;
}

// Tipos para o Modo de Jogo 'Duelo de Vocabulário'
export type DuelQuestionType = 'traducao' | 'falso_cognato' | 'explicacao_audio' | 'pronuncia_rapida' | 'completar';

export interface DuelQuestion {
  id: string;
  node_id?: string;
  tipo: DuelQuestionType;
  termo_principal: string;
  idioma_origem: string;
  idioma_alvo: string;
  pronuncia_ipa?: string;
  dica_contextual?: string;
  resposta_esperada: string;
  respostas_alternativas: string[];
  opcoes_multipla_escolha?: string[];
  tempo_limite_segundos: number; // padrão 12 a 15 segundos
  pontos_base: number; // 100 pontos
  nivel_dificuldade: number; // 1 a 5
  exemplo_frase?: string;
}

export interface DuelRoundAnswer {
  question_id: string;
  resposta_usuario: string;
  correta: boolean;
  tempo_gasto_segundos: number;
  pontos_ganhos: number;
  bonus_velocidade: number;
  bonus_precisao: number;
  precisao_porcentagem: number;
  is_audio: boolean;
  score_pronuncia?: number;
  feedback: string;
}

export interface DuelGameSession {
  id: string;
  idioma: string;
  modo: 'misto' | 'audio' | 'texto';
  questoes_totais: number;
  acertos: number;
  erros: number;
  pontuacao_total: number;
  maior_combo: number;
  xp_ganho: number;
  tempo_total_segundos: number;
  respostas: DuelRoundAnswer[];
  data_sessao: string;
}

// Tipos para o Sistema de Flashcards e Repetição Espaçada (SRS)
export type SRSGrade = 1 | 2 | 3 | 4; // 1: Novamente, 2: Difícil, 3: Bom, 4: Fácil

export type FlashcardFilterMode =
  | 'todos'
  | 'criticos' // Domínio < 50% ou erros frequentes
  | 'falsos_amigos' // Falsos amigos e cognatos enganosos
  | 'expressoes' // Expressões idiomáticas & collocations
  | 'vencidos_hoje'; // Agendados para hoje pela repetição espaçada

export interface SRSFlashcard {
  id: string;
  nodeId: string;
  termo: string;
  tipo: NodeType;
  idioma: string;
  pronuncia_ipa?: string;
  traducao: string;
  explicacao: string;
  exemplo_uso?: string;
  traducao_exemplo?: string;
  dica_mnemonica?: string;
  dominio_atual: number; // 0 a 100
  frequencia_erro: number;
  dificuldade: number; // 1 a 5
  proxima_revisao: string; // ISO string
  ultima_revisao?: string;
  intervalo_dias: number;
  repeticoes: number;
  fator_facilidade: number; // Ease Factor padrão 2.5 (SM-2)
  status_srs: 'novo' | 'aprendendo' | 'revisando' | 'dominado';
  tags: string[];
}

export interface SRSReviewResult {
  cardId: string;
  nodeId: string;
  grade: SRSGrade;
  antigo_dominio: number;
  novo_dominio: number;
  novo_intervalo_dias: number;
  proxima_revisao: string;
  xp_ganho: number;
  timestamp: string;
}

export interface WordContextExample {
  frase_original: string;
  traducao_portugues: string;
}

export interface WordContextInfo {
  palavra: string;
  lemma_raiz: string;
  classe_gramatical: string; // Ex: "Substantivo", "Verbo", "Adjetivo", "Phrasal Verb", "Advérbio", "Expressão"
  idioma: string;
  nivel_cefr: CEFRLevel;
  pronuncia_ipa: string;
  traducao_principal: string;
  definicao_contextual: string;
  sinonimos: string[];
  antonimos?: string[];
  exemplos_uso: WordContextExample[];
  falso_amigo_alerta?: string;
  dica_uso_ou_collocation?: string;
  origem_etimologia?: string;
}

export interface FlashcardSessionSummary {
  totalCards: number;
  revisados: number;
  novamenteCount: number;
  dificilCount: number;
  bomCount: number;
  facilCount: number;
  xpGanhoTotal: number;
  dominioMedioFinal: number;
  cartasDominadasHoje: number;
}

// Tipos de Autenticação e Perfis Multiusuário
export type UserRole = 'admin' | 'user';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt: string;
  isAnonymous?: boolean;
  statsSummary?: {
    level: number;
    xp: number;
    streak: number;
    nodesCount: number;
    materialsCount: number;
  };
}

export interface SharedKnowledgePack {
  id: string;
  titulo: string;
  descricao: string;
  idioma: string;
  nivel_cefr: CEFRLevel;
  autor_nome: string;
  autor_id: string;
  publicado_em: string;
  total_termos: number;
  total_materiais: number;
  clones_count?: number;
  tags?: string[];
  dados_pack: {
    nodes: GraphNode[];
    relations?: GraphRelation[];
    materials?: StudyMaterialItem[];
  };
}

export interface FrequentErrorItem {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string;
  conceito: string;
  erro: string;
  explicacao: string;
  resposta_corrigida: string;
  gravidade: CorrectionSeverity | string;
  evidencia: string;
  topico?: string;
  categoria?: 'gramatica' | 'vocabulario' | 'pronuncia' | 'falso_amigo' | 'outro';
  ocorrencias?: number;
  data: string;
  criado_em?: string;
  atualizado_em?: string;
}

// Tipos para o Assistente de Configuração Inicial (Onboarding Wizard) e Primeiro Plano de Estudos
export interface OnboardingAnswers {
  idioma_alvo: string;
  nivel_atual: CEFRLevel;
  motivo_principal: string;
  motivo_detalhado?: string;
  interesses: string[];
  tempo_diario_minutos: number;
  estilo_aprendizado: 'conversacao_voz' | 'vocabulario_flashcards' | 'gramatica_pratica' | 'equilibrio_completo';
  horario_preferido?: string;
}

export interface WeeklyPlanDay {
  dia_semana: string; // Ex: 'Segunda-feira', 'Terça-feira', etc.
  foco: string; // Ex: 'Vocabulário Chave & Collocations', 'Conversação em Voz', etc.
  duracao_minutos: number;
  tipo_atividade: 'chat' | 'flashcards' | 'duel' | 'materials';
  descricao_pratica: string;
}

export interface GeneratedStudyPlan {
  id: string;
  titulo_plano: string;
  descricao_plano: string;
  idioma: string;
  nivel_cefr: CEFRLevel;
  meta_diaria_minutos: number;
  motivo_principal: string;
  interesses_principais: string[];
  estilo_aprendizado: OnboardingAnswers['estilo_aprendizado'];
  topico_inicial_recomendado: string;
  mensagem_boas_vindas_tutor: string;
  estrategia_pedagogica: string;
  cronograma_semanal: WeeklyPlanDay[];
  nos_iniciais_grafo: Partial<GraphNode>[];
  primeiro_material_estudo: StudyMaterialItem;
  dicas_personalizadas: string[];
  criado_em: string;
}



