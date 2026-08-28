import { Achievement, GraphNode, PedagogicalCorrection, UserStats } from '../types';
import { StorageService } from './storage';
import confetti from 'canvas-confetti';

export interface AchievementEvaluationResult {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
}

export const ALL_SYSTEM_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'primeira_conversa',
    titulo: 'Primeiro Passo',
    descricao: 'Iniciou a jornada de estudos conversando ativamente com o tutor.',
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
    titulo: 'Mestre de Conceitos Difíceis',
    descricao: 'Alcançou domínio de 80% ou mais em um conceito complexo (dificuldade nível 4 ou 5) no grafo.',
    icone: 'Award',
    xp_recompensa: 250,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 80,
    categoria: 'dominio',
  },
  {
    id: 'maratonista_estudos',
    titulo: 'Maratonista de Estudos',
    descricao: 'Manteve uma sequência de pelo menos 3 dias consecutivos de estudo ativo.',
    icone: 'Flame',
    xp_recompensa: 200,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 3,
    categoria: 'consistencia',
  },
  {
    id: 'detetive_erros',
    titulo: 'Detetive de Erros',
    descricao: 'Identificou, esclareceu e consolidou com sucesso 3 ou mais equívocos conceituais com checagem.',
    icone: 'CheckCircle2',
    xp_recompensa: 180,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 3,
    categoria: 'correcao',
  },
  {
    id: 'arquiteto_saber',
    titulo: 'Arquiteto do Saber',
    descricao: 'Mapeou e conectou 5 ou mais nós no Grafo de Conhecimento com relacionamentos conceituais.',
    icone: 'Network',
    xp_recompensa: 220,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 5,
    categoria: 'grafo',
  },
  {
    id: 'voz_sabedoria',
    titulo: 'Voz da Sabedoria',
    descricao: 'Praticou conversação oral em tempo real com o Gemini Live API ou gravou explicações faladas.',
    icone: 'Mic',
    xp_recompensa: 150,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 2,
    categoria: 'voz',
  },
  {
    id: 'memoria_blindada',
    titulo: 'Memória Blindada',
    descricao: 'Concluiu revisões espaçadas de conceitos e vocabulário antes da expiração da memória.',
    icone: 'Brain',
    xp_recompensa: 160,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 2,
    categoria: 'dominio',
  },
  {
    id: 'criador_materiais',
    titulo: 'Estúdio de Materiais',
    descricao: 'Transformou vídeos do YouTube ou textos em kits de estudos completos com vocabulário e diálogos.',
    icone: 'BookOpen',
    xp_recompensa: 150,
    desbloqueada: false,
    progresso_atual: 0,
    progresso_meta: 1,
    categoria: 'materiais',
  },
];

export const AchievementEngine = {
  // Avalia todos os critérios das conquistas baseado no estado atual
  evaluateAll(): AchievementEvaluationResult {
    const savedAchievements = StorageService.getAchievements();
    const nodes = StorageService.getNodes();
    const relations = StorageService.getRelations();
    const corrections = StorageService.getCorrections();
    const stats = StorageService.getStats();
    const materials = StorageService.getMaterials();

    // 1. Mestre de Conceitos Difíceis: Conceito com dificuldade >= 4 e domínio >= 80%
    const difficultNodes = nodes.filter((n) => n.dificuldade >= 4);
    const maxDifficultDominio = difficultNodes.reduce(
      (max, n) => Math.max(max, n.dominio_estimado),
      0
    );
    const mestreDificeisDone = difficultNodes.some((n) => n.dominio_estimado >= 80);

    // 2. Maratonista de Estudos: Sequência de dias >= 3
    const maratonistaDone = stats.sequencia_dias >= 3;

    // 3. Detetive de Erros: Erros corrigidos e consolidados >= 3
    const errosCorrigidos = corrections.filter(
      (c) => c.estado_posterior === 'compreendido' && c.respondido_corretamente
    ).length;
    const detetiveDone = errosCorrigidos >= 3;

    // 4. Arquiteto do Saber: Nós no grafo >= 5 e relações >= 3
    const totalNodesCount = nodes.length;
    const totalRelationsCount = relations.length;
    const arquitetoDone = totalNodesCount >= 5 && totalRelationsCount >= 3;

    // 5. Voz da Sabedoria: Sessões de voz / áudio >= 2
    const voiceCount = stats.sessoes_voz_realizadas || 0;
    const vozDone = voiceCount >= 2;

    // 6. Memória Blindada: Nós revisados recentemente com domínio >= 70%
    const nosRevisadosAltaRetencao = nodes.filter(
      (n) => n.dominio_estimado >= 70 && n.frequencia_erro <= 1
    ).length;
    const memoriaDone = nosRevisadosAltaRetencao >= 2;

    // 7. Estúdio de Materiais: Materiais gerados ou adicionados >= 1
    const materialsDone = materials.length >= 1;

    const newlyUnlocked: Achievement[] = [];

    // Mescla com a lista mestre
    const updatedAchievements: Achievement[] = ALL_SYSTEM_ACHIEVEMENTS.map((template) => {
      const existing = savedAchievements.find((a) => a.id === template.id);
      const isAlreadyUnlocked = Boolean(existing?.desbloqueada);
      let isUnlockedNow = isAlreadyUnlocked;
      let currentProgress = existing?.progresso_atual || 0;
      let targetProgress = template.progresso_meta || 1;

      switch (template.id) {
        case 'primeira_conversa':
          isUnlockedNow = true;
          currentProgress = 1;
          break;
        case 'mestre_conceitos_dificeis':
          currentProgress = maxDifficultDominio;
          targetProgress = 80;
          if (mestreDificeisDone) isUnlockedNow = true;
          break;
        case 'maratonista_estudos':
          currentProgress = stats.sequencia_dias;
          targetProgress = 3;
          if (maratonistaDone) isUnlockedNow = true;
          break;
        case 'detetive_erros':
          currentProgress = errosCorrigidos;
          targetProgress = 3;
          if (detetiveDone) isUnlockedNow = true;
          break;
        case 'arquiteto_saber':
          currentProgress = totalNodesCount;
          targetProgress = 5;
          if (arquitetoDone) isUnlockedNow = true;
          break;
        case 'voz_sabedoria':
          currentProgress = voiceCount;
          targetProgress = 2;
          if (vozDone) isUnlockedNow = true;
          break;
        case 'memoria_blindada':
          currentProgress = nosRevisadosAltaRetencao;
          targetProgress = 2;
          if (memoriaDone) isUnlockedNow = true;
          break;
        case 'criador_materiais':
          currentProgress = materials.length;
          targetProgress = 1;
          if (materialsDone) isUnlockedNow = true;
          break;
      }

      const achievementObj: Achievement = {
        ...template,
        desbloqueada: isUnlockedNow,
        data_desbloqueio: isUnlockedNow
          ? existing?.data_desbloqueio || new Date().toISOString()
          : undefined,
        progresso_atual: Math.min(currentProgress, targetProgress),
        progresso_meta: targetProgress,
      };

      if (!isAlreadyUnlocked && isUnlockedNow) {
        newlyUnlocked.push(achievementObj);
      }

      return achievementObj;
    });

    // Salva conquistas atualizadas
    StorageService.saveAchievements(updatedAchievements);

    // Se houve novos desbloqueios, concede XP e dispara celebração
    if (newlyUnlocked.length > 0) {
      newlyUnlocked.forEach((ach) => {
        StorageService.addXP(ach.xp_recompensa);
      });
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
        });
      } catch (e) {}
    }

    return {
      achievements: updatedAchievements,
      newlyUnlocked,
    };
  },

  // Incrementa contador de sessões de voz
  recordVoiceInteraction(): void {
    const stats = StorageService.getStats();
    stats.sessoes_voz_realizadas = (stats.sessoes_voz_realizadas || 0) + 1;
    StorageService.saveStats(stats);
    this.evaluateAll();
  },
};
