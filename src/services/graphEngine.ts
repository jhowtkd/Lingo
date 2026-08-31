import {
  GraphNode,
  GraphRelation,
  NodeType,
  RelationType,
  WeeklyMetrics,
  ExplanationAdaptation,
  AdaptationLevel,
  PriorityTopicSuggestion,
} from '../types';
import { StorageService } from './storage';
import { normalizeUnicodeText, getLanguageConfig } from '../config/languages';
import { hasRecordedNodeEvidence } from './progressMetrics';

export const GraphEngine = {
  // Normaliza strings para busca e deduplicação preservando alfabetos internacionais
  normalize(text: string): string {
    return normalizeUnicodeText(text);
  },

  // Avalia o nível de compreensão do estudante no grafo e determina a estratégia de adaptação dinâmica
  analyzeStudentComprehension(
    topic: string,
    userMessage = '',
    language = 'Inglês'
  ): ExplanationAdaptation | null {
    const nodes = StorageService.getNodes();
    const langConfig = getLanguageConfig(language);
    const normTopic = this.normalize(topic);
    const normMsg = this.normalize(userMessage);

    // Isola estritamente os nós do idioma ativo
    const langNodes = nodes.filter((n) => {
      const nodeLang = getLanguageConfig(n.idioma || 'ingles');
      return nodeLang.id === langConfig.id;
    });

    // Filtra nós relacionados ao tópico ou à mensagem
    const relevantNodes = langNodes.filter((n) => {
      const normTitle = this.normalize(n.titulo);
      const normDesc = this.normalize(n.descricao);
      return (
        normTitle.includes(normTopic) ||
        normTopic.includes(normTitle) ||
        (normMsg && normMsg.includes(normTitle)) ||
        normDesc.includes(normTopic)
      );
    });

    const activeNodes = relevantNodes.length > 0 ? relevantNodes : langNodes;

    if (activeNodes.length === 0) return null;

    // Métricas do grafo para este contexto
    const activeMisconceptions = activeNodes.filter(
      (n) => n.tipo === 'equivoco' || (n.tipo === 'dificuldade' && n.dominio_estimado < 60)
    );
    const highDifficultyNodes = activeNodes.filter((n) => n.dificuldade >= 4);

    const totalDominio = activeNodes.reduce(
      (sum, node) => sum + Math.max(0, node.dominio_estimado ?? 0),
      0
    );
    const avgDominio = Math.round(totalDominio / activeNodes.length);

    // Determina o nível de adaptação dinâmica
    let nivel: AdaptationLevel = 'intermediario_aplicado';
    let rotulo = 'Intermediário com Aplicação Prática';
    let justificativa = '';
    let estrategia = '';

    if (avgDominio < 55 || activeMisconceptions.length > 0) {
      nivel = 'fundamental_analogico';
      rotulo = 'Fundamental com Analogias Concretas';
      justificativa = `Grafo identificou domínio médio de ${avgDominio}% com ${activeMisconceptions.length} equívoco(s)/dificuldade(s) ativa(s) em "${topic}" (${langConfig.displayName}).`;
      estrategia =
        'Priorizar metáforas do mundo real, decomposição em passos atômicos, validação de pré-requisitos e ausência de jargões herméticos.';
    } else if (avgDominio >= 80 && highDifficultyNodes.length > 0) {
      nivel = 'avancado_analitico';
      rotulo = 'Avançado e Rigoroso com Casos de Borda';
      justificativa = `Grafo identificou alto domínio consolidado (${avgDominio}%) em "${topic}" (${langConfig.displayName}). Pronto para aprofundamento analítico e cenários de borda.`;
      estrategia =
        'Utilizar rigor formal, análise assintótica, tradeoffs de implementação, provocação socrática de alto nível e desafios de síntese.';
    } else {
      nivel = 'intermediario_aplicado';
      rotulo = 'Intermediário com Formalização e Prática';
      justificativa = `Grafo identificou compreensão estável (${avgDominio}%) em "${topic}" (${langConfig.displayName}).`;
      estrategia =
        'Combinar intuição com vocabulário técnico preciso, exemplos práticos de código/aplicação e interconexão com nós adjacentes do grafo.';
    }

    return {
      nivel,
      rotulo,
      dominio_avaliado: avgDominio,
      justificativa,
      estrategia_pedagogica: estrategia,
      conceitos_relacionados: activeNodes.slice(0, 3).map((n) => n.titulo),
    };
  },

  // Registra a adaptação utilizada nos nós do grafo relevantes para rastreabilidade
  recordAdaptationUsed(topic: string, adaptation: ExplanationAdaptation, language = 'Inglês'): void {
    const nodes = StorageService.getNodes();
    const langConfig = getLanguageConfig(language);
    const normTopic = this.normalize(topic);

    nodes.forEach((node) => {
      const nodeLang = getLanguageConfig(node.idioma || 'ingles');
      if (nodeLang.id === langConfig.id) {
        if (
          this.normalize(node.titulo).includes(normTopic) ||
          normTopic.includes(this.normalize(node.titulo))
        ) {
          node.nivel_adaptacao_recente = adaptation.rotulo;
          node.atualizado_em = new Date().toISOString();
        }
      }
    });

    StorageService.saveNodes(nodes);
  },

  // Busca nós relevantes para o contexto da conversa com isolamento estrito de idioma e threshold de relevância
  getRelevantContext(topic: string, userMessage: string, limit = 3, language = 'Inglês'): GraphNode[] {
    const nodes = StorageService.getNodes();
    const langConfig = getLanguageConfig(language);
    const normTopic = this.normalize(topic);
    const normMsg = this.normalize(userMessage);

    // Isola por idioma
    const langNodes = nodes.filter((n) => {
      const nodeLang = getLanguageConfig(n.idioma || 'ingles');
      return nodeLang.id === langConfig.id;
    });

    const scored: Array<{ node: GraphNode; score: number }> = [];

    for (const node of langNodes) {
      let score = 0;
      const normTitle = this.normalize(node.titulo);
      const normDesc = this.normalize(node.descricao);

      if (normTitle && (normTitle.includes(normTopic) || normTopic.includes(normTitle))) {
        score += 10;
      }
      if (normTitle && normMsg && normMsg.includes(normTitle)) {
        score += 8;
      }
      if (normDesc && normTopic && normDesc.includes(normTopic)) {
        score += 4;
      }
      if (node.tipo === 'dificuldade' || node.tipo === 'equivoco' || node.tipo === 'falso_amigo') {
        score += 3;
      }
      if (node.proxima_revisao && new Date(node.proxima_revisao) <= new Date()) {
        score += 2;
      }

      // Threshold mínimo de relevância: apenas itens com evidência concreta
      if (score >= 6) {
        scored.push({ node, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.node);
  },

  // Deduplica e insere novos nós vindos da análise pedagógica
  processNewNodesFromTutor(
    newNodes: Partial<GraphNode & { relacionado_com?: string; tipo_relacao?: RelationType }>[],
    evidence: string,
    language = 'Inglês'
  ): GraphNode[] {
    const existingNodes = StorageService.getNodes();
    const langConfig = getLanguageConfig(language);
    const createdOrUpdated: GraphNode[] = [];

    for (const raw of newNodes) {
      if (!raw.titulo) continue;

      const normTitle = this.normalize(raw.titulo);
      const existing = existingNodes.find((n) => {
        const nLang = getLanguageConfig(n.idioma || 'ingles');
        return nLang.id === langConfig.id && (this.normalize(n.titulo) === normTitle || normTitle.includes(this.normalize(n.titulo)));
      });

      const now = new Date().toISOString();

      if (existing) {
        // Atualiza nó existente
        const updatedFreq = (existing.frequencia_erro || 0) + (raw.tipo === 'dificuldade' || raw.tipo === 'equivoco' ? 1 : 0);
        const novoDominio =
          raw.dominio_estimado !== undefined
            ? Math.round((existing.dominio_estimado + raw.dominio_estimado) / 2)
            : existing.dominio_estimado;

        const nextReview = this.calculateNextReview(novoDominio, updatedFreq);

        const updated: GraphNode = {
          ...existing,
          dominio_estimado: novoDominio,
          frequencia_erro: updatedFreq,
          ultima_revisao: now,
          proxima_revisao: nextReview,
          evidencias: [...new Set([...(existing.evidencias || []), evidence].filter(Boolean))],
          atualizado_em: now,
        };

        StorageService.addOrUpdateNode(updated);
        createdOrUpdated.push(updated);
      } else {
        // Cria novo nó
        const initialDominio = raw.dominio_estimado ?? 0;
        const nextReview = this.calculateNextReview(initialDominio, 1);

        const newNode: GraphNode = {
          id: `node-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          tipo: (raw.tipo as NodeType) || 'conceito',
          idioma: langConfig.displayName,
          titulo: raw.titulo,
          descricao: raw.descricao || `Conceito identificado durante a sessão: ${raw.titulo}`,
          dominio_estimado: initialDominio,
          dificuldade: raw.dificuldade || 3,
          frequencia_erro: raw.tipo === 'dificuldade' || raw.tipo === 'equivoco' ? 1 : 0,
          ultima_revisao: now,
          proxima_revisao: nextReview,
          evidencias: evidence ? [evidence] : [],
          criado_em: now,
          atualizado_em: now,
        };

        StorageService.addOrUpdateNode(newNode);
        createdOrUpdated.push(newNode);

        // Se houver relação sugerida
        if (raw.relacionado_com) {
          const targetNorm = this.normalize(raw.relacionado_com);
          const targetNode = existingNodes.find((n) => {
            const nLang = getLanguageConfig(n.idioma || 'ingles');
            return nLang.id === langConfig.id && this.normalize(n.titulo).includes(targetNorm);
          });

          if (targetNode) {
            const rel: GraphRelation = {
              id: `rel-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              origem_id: newNode.id,
              destino_id: targetNode.id,
              tipo: raw.tipo_relacao || 'relacionado_a',
              peso: 0.8,
              evidencia: evidence,
              criado_em: now,
            };
            StorageService.addRelation(rel);
          }
        }
      }
    }

    return createdOrUpdated;
  },

  // Algoritmo de repetição espaçada simplificado
  calculateNextReview(dominio: number, frequenciaErro: number): string {
    const now = new Date();
    let diasOffset = 1;

    if (dominio >= 85 && frequenciaErro <= 1) {
      diasOffset = 7; // Domínio alto: revisa em 1 semana
    } else if (dominio >= 65) {
      diasOffset = 3; // Domínio médio: revisa em 3 dias
    } else if (dominio >= 50) {
      diasOffset = 1; // Domínio em desenvolvimento: revisa amanhã
    } else {
      diasOffset = 0; // Domínio baixo/erro crítico: precisa revisar hoje/imediato
    }

    const nextDate = new Date(now.getTime() + diasOffset * 86400000);
    return nextDate.toISOString();
  },

  // Métricas Semanais Computadas dos Dados Reais
  calculateWeeklyMetrics(): WeeklyMetrics {
    const nodes = StorageService.getNodes();
    const recordedNodes = nodes.filter(hasRecordedNodeEvidence);
    const sessions = StorageService.getSessions().filter((session) => session.concluida);
    const corrections = StorageService.getCorrections();
    const stats = StorageService.getStats();

    const now = new Date();
    const metaDiariaMinutos = Math.max(1, stats.meta_diaria_minutos);
    const seteDiasAtras = new Date(now.getTime() - 7 * 86400000);
    const quatorzeDiasAtras = new Date(now.getTime() - 14 * 86400000);
    const hoje = now.toISOString().slice(0, 10);

    const sessoesUltimos7Dias = sessions.filter(
      (session) => new Date(session.inicio) >= seteDiasAtras
    );
    const sessoesSemanaAnterior = sessions.filter((s) => {
      const inicio = new Date(s.inicio);
      return inicio >= quatorzeDiasAtras && inicio < seteDiasAtras;
    });

    const minutosHojeEmSessoes = sessoesUltimos7Dias
      .filter((session) => session.inicio.startsWith(hoje))
      .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
    const minutosOutrosDias = sessoesUltimos7Dias
      .filter((session) => !session.inicio.startsWith(hoje))
      .reduce((sum, session) => sum + Math.max(0, session.duracao_minutos), 0);
    const minutosEstudados =
      minutosOutrosDias + Math.max(minutosHojeEmSessoes, Math.max(0, stats.minutos_hoje));
    const minutosSemanaAnterior = sessoesSemanaAnterior.reduce(
      (sum, session) => sum + Math.max(0, session.duracao_minutos),
      0
    );

    const totalRespostas = sessoesUltimos7Dias.reduce(
      (sum, session) => sum + Math.max(0, session.respostas_totais),
      0
    );
    const respostasCorretas = sessoesUltimos7Dias.reduce(
      (sum, session) => sum + Math.max(0, session.respostas_corretas),
      0
    );
    const taxaAcerto = totalRespostas > 0
      ? Math.round((respostasCorretas / totalRespostas) * 100)
      : 0;

    const totalRespostasAnterior = sessoesSemanaAnterior.reduce(
      (sum, session) => sum + Math.max(0, session.respostas_totais),
      0
    );
    const respostasCorretasAnterior = sessoesSemanaAnterior.reduce(
      (sum, session) => sum + Math.max(0, session.respostas_corretas),
      0
    );
    const taxaAcertoAnterior = totalRespostasAnterior > 0
      ? Math.round((respostasCorretasAnterior / totalRespostasAnterior) * 100)
      : 0;
    const xpGanho = sessoesUltimos7Dias.reduce(
      (sum, session) => sum + Math.max(0, session.xp_obtido),
      0
    );
    const xpSemanaAnterior = sessoesSemanaAnterior.reduce(
      (sum, session) => sum + Math.max(0, session.xp_obtido),
      0
    );

    const correcoesSemana = corrections.filter(
      (correction) => new Date(correction.data) >= seteDiasAtras
    );
    const errosCorrigidos = correcoesSemana.filter(
      (correction) => correction.estado_posterior === 'compreendido'
    ).length;
    const errosRecorrentes = correcoesSemana.filter(
      (correction) =>
        correction.estado_posterior === 'precisa_revisar' ||
        correction.gravidade === 'critica'
    ).length;
    const revisoesPendentes = recordedNodes.filter(
      (node) => new Date(node.proxima_revisao) <= now
    ).length;
    const topicosDificeis = recordedNodes
      .filter(
        (node) =>
          node.tipo === 'dificuldade' ||
          node.tipo === 'equivoco' ||
          node.frequencia_erro > 0
      )
      .sort((a, b) => b.frequencia_erro - a.frequencia_erro)
      .slice(0, 4)
      .map((node) => ({
        topico: node.titulo,
        erros: node.frequencia_erro,
        dominio_medio: node.dominio_estimado,
      }));

    const minutosPorDia = new Map<string, number>();
    sessoesUltimos7Dias.forEach((session) => {
      const dia = session.inicio.slice(0, 10);
      minutosPorDia.set(
        dia,
        (minutosPorDia.get(dia) ?? 0) + Math.max(0, session.duracao_minutos)
      );
    });
    minutosPorDia.set(
      hoje,
      Math.max(minutosPorDia.get(hoje) ?? 0, Math.max(0, stats.minutos_hoje))
    );
    const metasDiasConcluidas = [...minutosPorDia.values()].filter(
      (minutes) => minutes >= metaDiariaMinutos
    ).length;
    const percentageDelta = (current: number, previous: number) =>
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;

    return {
      periodo: {
        inicio: seteDiasAtras.toISOString().slice(0, 10),
        fim: now.toISOString().slice(0, 10),
      },
      sessoes_realizadas: sessoesUltimos7Dias.length,
      minutos_estudados: minutosEstudados,
      total_respostas: totalRespostas,
      respostas_corretas: respostasCorretas,
      taxa_acerto: taxaAcerto,
      erros_corrigidos: errosCorrigidos,
      erros_recorrentes: errosRecorrentes,
      xp_ganho: xpGanho,
      sequencia_atual: stats.sequencia_dias,
      metas_dias_concluidas: metasDiasConcluidas,
      topicos_dificeis: topicosDificeis,
      evolucao_dominio: [],
      revisoes_pendentes: revisoesPendentes,
      comparativo_semana_anterior: {
        minutos_delta_pct: percentageDelta(minutosEstudados, minutosSemanaAnterior),
        taxa_acerto_delta_pct: percentageDelta(taxaAcerto, taxaAcertoAnterior),
        xp_delta_pct: percentageDelta(xpGanho, xpSemanaAnterior),
      },
      recomendacao_objetiva: topicosDificeis.length > 0
        ? `Dedique a próxima sessão para revisar ${topicosDificeis[0].topico}, o ponto com mais equívocos registrados.`
        : sessoesUltimos7Dias.length === 0 && recordedNodes.length === 0
          ? 'Conclua uma prática para que o painel identifique prioridades com base em evidências.'
          : 'Nenhuma prioridade específica foi identificada nas evidências registradas.',
    };
  },

  // NOVO: Analisa profundamente a topologia do Grafo de Memória e extrai os 3 tópicos prioritários para a próxima sessão de chat
  getPriorityTopicsFromMemoryGraph(limit = 3): PriorityTopicSuggestion[] {
    const nodes = StorageService.getNodes().filter(hasRecordedNodeEvidence);
    const relations = StorageService.getRelations();
    const corrections = StorageService.getCorrections();
    const now = new Date();

    if (!nodes || nodes.length === 0) {
      return [];
    }

    // Filtra apenas nós específicos com alto valor pedagógico (evita o nó raiz genérico se houver itens filhos)
    const specificNodes = nodes.filter(
      (n) => n.tipo !== 'topico' || nodes.filter((sub) => sub.topico_pai === n.id).length === 0
    );

    const candidateNodes = specificNodes.length >= limit ? specificNodes : nodes;

    // Calcula score ponderado de prioridade para cada nó
    const scoredNodes = candidateNodes.map((node) => {
      let score = 0;
      const mastery = node.dominio_estimado ?? 50;
      const errorFreq = node.frequencia_erro ?? 0;
      const difficulty = node.dificuldade ?? 3;
      const isOverdue = node.proxima_revisao ? new Date(node.proxima_revisao) <= now : false;

      // 1. Domínio Frágil (Quanto menor o domínio, mais urgente)
      if (mastery < 45) score += 45;
      else if (mastery < 60) score += 30;
      else if (mastery < 75) score += 15;

      // 2. Frequência de Erro Histórico
      score += Math.min(errorFreq * 18, 54);

      // 3. Complexidade / Dificuldade
      score += difficulty * 5;

      // 4. Tipo de Nó (Falsos amigos, dificuldades e equívocos têm prioridade cognitiva imediata)
      if (node.tipo === 'falso_amigo') score += 40;
      else if (node.tipo === 'dificuldade' || node.tipo === 'equivoco') score += 42;
      else if (node.tipo === 'gramatica') score += 22;
      else if (node.tipo === 'vocabulario') score += 16;

      // 5. Revisão Espaçada Vencida (Curva do Esquecimento)
      if (isOverdue) score += 28;

      // 6. Correções recentes associadas que precisam de revisão
      const normTitle = this.normalize(node.titulo);
      const pendingCorrections = corrections.filter((c) => {
        const normConceito = this.normalize(c.conceito);
        return (
          (normConceito.includes(normTitle) || normTitle.includes(normConceito)) &&
          (c.estado_posterior === 'precisa_revisar' || !c.respondido_corretamente)
        );
      });
      score += pendingCorrections.length * 20;

      // 7. Relações e conexões no grafo (Gargalos)
      const connectedEdges = relations.filter(
        (r) => r.origem_id === node.id || r.destino_id === node.id
      );
      score += Math.min(connectedEdges.length * 4, 20);

      // Descobre nomes dos nós vizinhos no grafo
      const neighborNames = connectedEdges
        .map((r) => {
          const neighborId = r.origem_id === node.id ? r.destino_id : r.origem_id;
          const neighborNode = nodes.find((n) => n.id === neighborId);
          return neighborNode ? neighborNode.titulo : null;
        })
        .filter(Boolean) as string[];

      // Determina o Nível de Urgência
      let nivel_urgencia: 'critica' | 'alta' | 'moderada' = 'moderada';
      if (
        score >= 85 ||
        (mastery < 50 && (errorFreq >= 2 || node.tipo === 'falso_amigo')) ||
        pendingCorrections.length > 0
      ) {
        nivel_urgencia = 'critica';
      } else if (score >= 50 || isOverdue || mastery < 65 || errorFreq >= 1) {
        nivel_urgencia = 'alta';
      }

      // Diagnóstico Pedagógico formatado
      let motivo_prioridade = 'Consolidação de Fluência';
      let estrategia_sugerida =
        'Fazer um roleplay conversacional focado e responder à checagem do tutor.';

      if (node.tipo === 'falso_amigo') {
        motivo_prioridade = 'Falso Cognato / Armadilha de Tradução';
        estrategia_sugerida =
          'Praticar contraste com a palavra correta em 3 contextos reais para desativar a interferência do português.';
      } else if (node.tipo === 'dificuldade' || errorFreq >= 2) {
        motivo_prioridade = 'Equívoco Ativo Recorrente & Baixo Domínio';
        estrategia_sugerida =
          'Pedir ao tutor 2 exemplos práticos e uma pergunta de validação imediata para solidificar o conceito.';
      } else if (isOverdue) {
        motivo_prioridade = 'Revisão Espaçada (SRS) Vencida';
        estrategia_sugerida =
          'Reativar na memória de longo prazo antes que o esquecimento natural cause regressão no domínio.';
      } else if (mastery < 60) {
        motivo_prioridade = 'Gargalo de Domínio no Grafo';
        estrategia_sugerida =
          'Treinar a estrutura passo a passo com analogias simplificadas e validação socrática.';
      }

      const desc =
        node.descricao ||
        `Tópico identificado com domínio estimado de ${mastery}% e ${errorFreq} equívoco(s) no histórico.`;

      return {
        node,
        score,
        suggestion: {
          id: `prio-${node.id}`,
          titulo: node.titulo,
          motivo_prioridade,
          descricao_pedagogica: desc,
          dominio_atual: mastery,
          frequencia_erro: errorFreq,
          dificuldade: difficulty,
          tipo_no: node.tipo,
          estrategia_sugerida,
          nivel_urgencia,
          nos_relacionados: neighborNames.slice(0, 3),
          exemplos_praticos: node.exemplo_uso ? [node.exemplo_uso] : undefined,
        } as PriorityTopicSuggestion,
      };
    });

    // Ordena pelo maior score decrescente
    scoredNodes.sort((a, b) => b.score - a.score);

    return scoredNodes.slice(0, limit).map((item) => item.suggestion);
  },
};
