import {
  GraphNode,
  SRSFlashcard,
  SRSGrade,
  SRSReviewResult,
  FlashcardFilterMode,
  UserStats,
} from '../types';
import { StorageService } from './storage';

export class FlashcardsEngine {
  /**
   * Converte nós do Grafo de Memória em Flashcards com agendamento SRS (SM-2 adaptado).
   * Prioriza termos com menor domínio, maior frequência de erro e maior dificuldade.
   */
  static getFlashcardsFromGraph(
    idiomaFiltro: string,
    filterMode: FlashcardFilterMode = 'todos'
  ): SRSFlashcard[] {
    const allNodes = StorageService.getNodes();
    const now = new Date();

    // Filtra por idioma
    const normLang = (idiomaFiltro || '').toLowerCase();
    let langNodes = allNodes.filter((node) => {
      const nodeLang = (node.idioma || '').toLowerCase();
      if (!nodeLang) return true; // se não especificado, inclui
      return (
        normLang.includes(nodeLang) ||
        nodeLang.includes(normLang) ||
        node.titulo.toLowerCase().includes(normLang)
      );
    });

    if (langNodes.length === 0) {
      langNodes = allNodes;
    }

    // Aplica o filtro selecionado
    let filteredNodes = langNodes.filter((node) => {
      if (filterMode === 'criticos') {
        return node.dominio_estimado < 60 || node.frequencia_erro >= 2 || node.dificuldade >= 4;
      }
      if (filterMode === 'falsos_amigos') {
        return node.tipo === 'falso_amigo' || node.titulo.toLowerCase().includes('vs') || node.titulo.toLowerCase().includes('falso');
      }
      if (filterMode === 'expressoes') {
        return node.tipo === 'expressao_idiomatica' || node.tipo === 'vocabulario';
      }
      if (filterMode === 'vencidos_hoje') {
        const proxRev = new Date(node.proxima_revisao || node.criado_em);
        return proxRev <= now;
      }
      return true;
    });

    if (filteredNodes.length === 0) {
      filteredNodes = langNodes;
    }

    // Ordena priorizando termos com menor domínio e maior dificuldade/erro
    filteredNodes.sort((a, b) => {
      // 1. Menor domínio primeiro
      const diffDom = a.dominio_estimado - b.dominio_estimado;
      if (Math.abs(diffDom) > 10) return diffDom;

      // 2. Maior frequência de erro
      const diffErr = b.frequencia_erro - a.frequencia_erro;
      if (diffErr !== 0) return diffErr;

      // 3. Maior dificuldade
      return b.dificuldade - a.dificuldade;
    });

    // Mapeia para SRSFlashcard
    return filteredNodes.map((node) => this.convertNodeToFlashcard(node));
  }

  /**
   * Converte um nó individual em cartão SRS com heurísticas pedagógicas
   */
  static convertNodeToFlashcard(node: GraphNode): SRSFlashcard {
    // Determina o status no ciclo SRS baseado no domínio
    let status_srs: SRSFlashcard['status_srs'] = 'novo';
    if (node.dominio_estimado >= 85) {
      status_srs = 'dominado';
    } else if (node.dominio_estimado >= 50) {
      status_srs = 'revisando';
    } else if (node.dominio_estimado > 0) {
      status_srs = 'aprendendo';
    }

    // Extrai significado e dica
    let traducao = node.traducao || '';
    if (!traducao) {
      if (node.descricao.includes('significa')) {
        const parts = node.descricao.split('significa');
        traducao = parts[1]?.split('.')[0]?.trim() || node.titulo;
      } else {
        traducao = node.descricao.split('.')[0] || node.titulo;
      }
    }

    // Gera dica mnemônica para falsos amigos ou conceitos complexos
    let dica_mnemonica = '';
    if (node.tipo === 'falso_amigo') {
      dica_mnemonica = `🚨 Cuidado: não traduza ao pé da letra pelo som em português!`;
    } else if (node.frequencia_erro >= 2) {
      dica_mnemonica = `⚠️ Você já confundiu este termo ${node.frequencia_erro}x. Foque no contexto da frase.`;
    } else if (node.dificuldade >= 4) {
      dica_mnemonica = `💡 Termo de alta complexidade. Repita em voz alta para fixar o ritmo fonético.`;
    }

    const tags: string[] = [
      node.tipo.replace('_', ' '),
      `Dificuldade ${node.dificuldade}/5`,
      `Domínio: ${node.dominio_estimado}%`,
    ];

    if (node.idioma) tags.push(node.idioma);

    return {
      id: `card-${node.id}`,
      nodeId: node.id,
      termo: node.titulo,
      tipo: node.tipo,
      idioma: node.idioma || 'Inglês',
      pronuncia_ipa: node.pronuncia_ipa,
      traducao,
      explicacao: node.descricao,
      exemplo_uso: node.exemplo_uso,
      traducao_exemplo: '',
      dica_mnemonica,
      dominio_atual: node.dominio_estimado || 30,
      frequencia_erro: node.frequencia_erro || 0,
      dificuldade: node.dificuldade || 3,
      proxima_revisao: node.proxima_revisao || new Date().toISOString(),
      ultima_revisao: node.ultima_revisao,
      intervalo_dias: node.dominio_estimado > 70 ? 4 : 1,
      repeticoes: Math.max(1, Math.floor(node.dominio_estimado / 25)),
      fator_facilidade: 2.5,
      status_srs,
      tags,
    };
  }

  /**
   * Processa a resposta do usuário no modelo de Repetição Espaçada (SM-2 adaptado)
   * e atualiza o Grafo de Memória e as estatísticas do usuário.
   */
  static processReview(
    card: SRSFlashcard,
    grade: SRSGrade,
    currentStats: UserStats
  ): {
    result: SRSReviewResult;
    updatedCard: SRSFlashcard;
    updatedStats: UserStats;
    repeatInSession: boolean;
  } {
    const now = new Date();
    let novo_dominio = card.dominio_atual;
    let novo_intervalo_dias = 1;
    let repeatInSession = false;
    let xp_ganho = 10;
    let nova_frequencia_erro = card.frequencia_erro;

    // Algoritmo de Repetição Espaçada (SRS)
    switch (grade) {
      case 1: // 🔴 Novamente (Errou ou não lembrou)
        novo_dominio = Math.max(10, card.dominio_atual - 15);
        novo_intervalo_dias = 0; // Praticar ainda hoje
        nova_frequencia_erro += 1;
        repeatInSession = true;
        xp_ganho = 5;
        break;

      case 2: // 🟠 Difícil (Lembrou com muito esforço ou hesitação)
        novo_dominio = Math.min(95, card.dominio_atual + 5);
        novo_intervalo_dias = 1;
        xp_ganho = 12;
        break;

      case 3: // 🟢 Bom (Resposta correta e tempo adequado)
        novo_dominio = Math.min(98, card.dominio_atual + 15);
        novo_intervalo_dias = Math.max(2, Math.round(card.intervalo_dias * 2.2));
        if (nova_frequencia_erro > 0) nova_frequencia_erro -= 1;
        xp_ganho = 20;
        break;

      case 4: // 🔵 Fácil (Domínio perfeito e imediato)
        novo_dominio = Math.min(100, card.dominio_atual + 25);
        novo_intervalo_dias = Math.max(4, Math.round(card.intervalo_dias * 3.5));
        if (nova_frequencia_erro > 0) nova_frequencia_erro -= 1;
        xp_ganho = 30;
        break;
    }

    // Calcula próxima data de revisão
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + novo_intervalo_dias);
    const proxima_revisao = nextDate.toISOString();

    // Atualiza o nó original no Grafo de Memória do StorageService
    const allNodes = StorageService.getNodes();
    const targetNode = allNodes.find((n) => n.id === card.nodeId);
    if (targetNode) {
      targetNode.dominio_estimado = novo_dominio;
      targetNode.frequencia_erro = nova_frequencia_erro;
      targetNode.ultima_revisao = now.toISOString();
      targetNode.proxima_revisao = proxima_revisao;
      targetNode.atualizado_em = now.toISOString();
      StorageService.addOrUpdateNode(targetNode);
    }

    // Status do Cartão Atualizado
    let novoStatus: SRSFlashcard['status_srs'] = 'aprendendo';
    if (novo_dominio >= 85) novoStatus = 'dominado';
    else if (novo_dominio >= 50) novoStatus = 'revisando';

    const updatedCard: SRSFlashcard = {
      ...card,
      dominio_atual: novo_dominio,
      frequencia_erro: nova_frequencia_erro,
      ultima_revisao: now.toISOString(),
      proxima_revisao,
      intervalo_dias: novo_intervalo_dias,
      repeticoes: card.repeticoes + 1,
      status_srs: novoStatus,
    };

    // Atualiza UserStats e Conquistas
    const newTotalAnswers = (currentStats.total_respostas || 0) + 1;
    const isCorrect = grade >= 2;
    const newCorrectAnswers = (currentStats.respostas_corretas || 0) + (isCorrect ? 1 : 0);
    const newErrorsCorrected =
      (currentStats.erros_corrigidos || 0) + (grade >= 3 && card.frequencia_erro > 0 ? 1 : 0);

    const newXp = currentStats.xp + xp_ganho;
    const currentLevelBase = Math.pow(currentStats.nivel, 2) * 80;
    const newLevel = newXp >= currentLevelBase ? currentStats.nivel + 1 : currentStats.nivel;

    // Verifica Conquistas de Repetição Espaçada
    const unlockedAchievements = [...(currentStats.conquistas_desbloqueadas || [])];
    if (novo_dominio >= 80 && !unlockedAchievements.includes('mestre_conceitos_dificeis')) {
      unlockedAchievements.push('mestre_conceitos_dificeis');
    }
    if (!unlockedAchievements.includes('memoria_blindada')) {
      unlockedAchievements.push('memoria_blindada');
    }

    const updatedStats: UserStats = {
      ...currentStats,
      xp: newXp,
      nivel: newLevel,
      total_respostas: newTotalAnswers,
      respostas_corretas: newCorrectAnswers,
      erros_corrigidos: newErrorsCorrected,
      conquistas_desbloqueadas: unlockedAchievements,
      minutos_hoje: (currentStats.minutos_hoje || 0) + 1,
    };

    StorageService.saveStats(updatedStats);

    const result: SRSReviewResult = {
      cardId: card.id,
      nodeId: card.nodeId,
      grade,
      antigo_dominio: card.dominio_atual,
      novo_dominio,
      novo_intervalo_dias,
      proxima_revisao,
      xp_ganho,
      timestamp: now.toISOString(),
    };

    return {
      result,
      updatedCard,
      updatedStats,
      repeatInSession,
    };
  }
}
