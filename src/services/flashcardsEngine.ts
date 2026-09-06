import {
  GraphNode,
  SRSFlashcard,
  SRSGrade,
  SRSReviewResult,
  FlashcardFilterMode,
  UserStats,
} from '../types';
import { StorageService } from './storage';
import { getLanguageConfig } from '../config/languages';
import { AchievementEngine } from './achievementEngine';

export class FlashcardsEngine {
  /**
   * Converte nós do Grafo de Memória em Flashcards com agendamento SRS (SM-2 adaptado).
   * Prioriza termos com menor domínio, maior frequência de erro e maior dificuldade com isolamento estrito de idioma.
   */
  static getFlashcardsFromGraph(
    idiomaFiltro: string,
    filterMode: FlashcardFilterMode = 'todos'
  ): SRSFlashcard[] {
    const allNodes = StorageService.getNodes();
    const targetLang = getLanguageConfig(idiomaFiltro);
    const now = new Date();

    // Filtra por idioma de forma estrita
    let langNodes = allNodes.filter((node) => {
      const nodeLang = getLanguageConfig(node.idioma || 'ingles');
      return nodeLang.id === targetLang.id;
    });

    // Aplica o filtro selecionado
    let filteredNodes = langNodes.filter((node) => {
      if (filterMode === 'menor_acerto') {
        return node.dominio_estimado < 70 || node.frequencia_erro >= 1 || node.dificuldade >= 3;
      }
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

    // Se o filtro for 'menor_acerto' ou 'criticos' e a lista estiver vazia mas houver nós no idioma,
    // seleciona os nós com menor domínio existente no grafo para garantir uma sessão focada
    if ((filterMode === 'menor_acerto' || filterMode === 'criticos') && filteredNodes.length === 0 && langNodes.length > 0) {
      filteredNodes = [...langNodes].sort((a, b) => a.dominio_estimado - b.dominio_estimado).slice(0, 6);
    }

    // Ordena priorizando termos com menor taxa de acerto/domínio e maior erro/dificuldade
    filteredNodes.sort((a, b) => {
      // 1. Menor domínio (taxa de acerto) primeiro
      const diffDom = a.dominio_estimado - b.dominio_estimado;
      if (diffDom !== 0) return diffDom;

      // 2. Maior frequência de erro
      const diffErr = b.frequencia_erro - a.frequencia_erro;
      if (diffErr !== 0) return diffErr;

      // 3. Maior dificuldade
      return b.dificuldade - a.dificuldade;
    });

    // Se for 'menor_acerto', limita o deck a uma sessão rápida focada (máximo 8 cards)
    if (filterMode === 'menor_acerto' && filteredNodes.length > 8) {
      filteredNodes = filteredNodes.slice(0, 8);
    }

    // Mapeia para SRSFlashcard
    return filteredNodes.map((node) => this.convertNodeToFlashcard(node));
  }

  /**
   * Recupera os termos com menor taxa de acerto / retenção do Grafo de Memória para o idioma ativo.
   */
  static getLowestAccuracyTerms(idiomaFiltro: string, limit = 5): GraphNode[] {
    const allNodes = StorageService.getNodes();
    const targetLang = getLanguageConfig(idiomaFiltro);

    const langNodes = allNodes.filter((node) => {
      const nodeLang = getLanguageConfig(node.idioma || 'ingles');
      return nodeLang.id === targetLang.id;
    });

    return [...langNodes]
      .sort((a, b) => {
        // Menor domínio primeiro
        const diffDom = a.dominio_estimado - b.dominio_estimado;
        if (diffDom !== 0) return diffDom;
        // Maior frequência de erro
        const diffErr = b.frequencia_erro - a.frequencia_erro;
        if (diffErr !== 0) return diffErr;
        return b.dificuldade - a.dificuldade;
      })
      .slice(0, limit);
  }

  /**
   * Estatísticas dos termos de menor retenção do grafo para exibição no HomeOverview.
   */
  static getLowestAccuracyStats(idiomaFiltro: string): {
    totalCriticalCount: number;
    avgDominio: number;
    lowestTerms: GraphNode[];
  } {
    const lowestTerms = this.getLowestAccuracyTerms(idiomaFiltro, 5);
    const criticalNodes = lowestTerms.filter((n) => n.dominio_estimado < 70 || n.frequencia_erro >= 1);

    const avgDominio =
      lowestTerms.length > 0
        ? Math.round(lowestTerms.reduce((sum, n) => sum + (n.dominio_estimado || 0), 0) / lowestTerms.length)
        : 50;

    return {
      totalCriticalCount: criticalNodes.length > 0 ? criticalNodes.length : lowestTerms.length,
      avgDominio,
      lowestTerms,
    };
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
      dominio_atual: node.dominio_estimado ?? 0,
      frequencia_erro: node.frequencia_erro ?? 0,
      dificuldade: node.dificuldade ?? 3,
      proxima_revisao: node.proxima_revisao || new Date().toISOString(),
      ultima_revisao: node.ultima_revisao,
      intervalo_dias: node.dominio_estimado > 70 ? 4 : 1,
      repeticoes: Math.max(0, Math.floor((node.dominio_estimado ?? 0) / 25)),
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

    const interimStats: UserStats = {
      ...currentStats,
      xp: newXp,
      nivel: newLevel,
      total_respostas: newTotalAnswers,
      respostas_corretas: newCorrectAnswers,
      erros_corrigidos: newErrorsCorrected,
    };

    StorageService.saveStats(interimStats);

    // Avalia conquistas reais baseadas em regras de negócio verificadas
    AchievementEngine.evaluateAll();
    const updatedStats = StorageService.getStats();

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
