import { Achievement, GraphNode, PedagogicalCorrection, UserStats } from '../types';
import { StorageService } from './storage';
import { fireConfetti as confetti } from '../lib/confetti';
import { ACHIEVEMENT_TEMPLATES } from './achievementTemplates';

export interface AchievementEvaluationResult {
  achievements: Achievement[];
  newlyUnlocked: Achievement[];
}

export const ALL_SYSTEM_ACHIEVEMENTS: Achievement[] = ACHIEVEMENT_TEMPLATES;

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
    const savedById = new Map(savedAchievements.map((a) => [a.id, a]));
    const updatedAchievements: Achievement[] = ALL_SYSTEM_ACHIEVEMENTS.map((template) => {
      const existing = savedById.get(template.id);
      const isAlreadyUnlocked = Boolean(existing?.desbloqueada);
      let isUnlockedNow = isAlreadyUnlocked;
      let currentProgress = existing?.progresso_atual || 0;
      let targetProgress = template.progresso_meta || 1;

      switch (template.id) {
        case 'primeira_conversa':
          currentProgress = Math.min(stats.total_respostas, 1);
          targetProgress = 1;
          if (stats.total_respostas >= 1) isUnlockedNow = true;
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
