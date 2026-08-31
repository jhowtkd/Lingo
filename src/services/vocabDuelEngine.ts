import {
  DuelQuestion,
  DuelRoundAnswer,
  DuelGameSession,
  GraphNode,
  UserStats,
} from '../types';
import { StorageService } from './storage';
import { GraphEngine } from './graphEngine';
import { normalizeUnicodeText, getLanguageConfig } from '../config/languages';

export const VocabDuelEngine = {
  // Normalizador de texto para comparação tolerante preservando Unicode
  normalizeAnswer(text: string): string {
    return normalizeUnicodeText(text);
  },

  getEligibleNodes(idiomaAlvo = 'Inglês'): GraphNode[] {
    const targetLang = getLanguageConfig(idiomaAlvo);
    return StorageService.getNodes().filter((node) => {
      const nodeLang = getLanguageConfig(node.idioma || 'ingles');
      return (
        nodeLang.id === targetLang.id &&
        ['vocabulario', 'falso_amigo', 'expressao_idiomatica', 'dificuldade', 'conceito'].includes(node.tipo)
      );
    });
  },

  // Seleciona termos do Grafo de Memória e gera um lote de perguntas para o Duelo com isolamento estrito de idioma
  generateDuelQuestions(idiomaAlvo: string = 'Inglês', totalQuestions: number = 8): DuelQuestion[] {
    const targetLang = getLanguageConfig(idiomaAlvo);
    const relevantNodes = this.getEligibleNodes(idiomaAlvo);

    // Ordena nós priorizando os com menor domínio ou maior frequência de erro
    const sortedNodes = [...relevantNodes].sort((a, b) => {
      const scoreA = 100 - (a.dominio_estimado ?? 0) + (a.frequencia_erro ?? 0) * 15;
      const scoreB = 100 - (b.dominio_estimado ?? 0) + (b.frequencia_erro ?? 0) * 15;
      return scoreB - scoreA;
    });

    const questions: DuelQuestion[] = [];
    const usedTitles = new Set<string>();

    for (const node of sortedNodes) {
      if (questions.length >= totalQuestions) break;
      if (usedTitles.has(node.titulo)) continue;
      usedTitles.add(node.titulo);

      const q = this.buildQuestionFromNode(node, targetLang.displayName);
      if (q) {
        questions.push(q);
      }
    }

    // Embaralha as perguntas para garantir variedade
    return questions.sort(() => Math.random() - 0.5).slice(0, totalQuestions);
  },

  // Constrói uma pergunta estruturada a partir de um nó do grafo
  buildQuestionFromNode(node: GraphNode, idiomaAlvo: string): DuelQuestion | null {
    const isFalseFriend = node.tipo === 'falso_amigo' || node.titulo.toLowerCase().includes('vs');

    if (isFalseFriend) {
      return {
        id: `duel-q-${node.id}-${Date.now()}`,
        node_id: node.id,
        tipo: 'falso_cognato',
        termo_principal: node.titulo,
        idioma_origem: idiomaAlvo,
        idioma_alvo: 'Português',
        pronuncia_ipa: node.pronuncia_ipa,
        dica_contextual: 'Atenção ao falso cognato! Não traduza pela semelhança gráfica.',
        resposta_esperada: node.traducao || node.descricao,
        respostas_alternativas: this.extractKeywords(node.traducao || node.descricao),
        opcoes_multipla_escolha: this.generateDistractors(node),
        tempo_limite_segundos: 14,
        pontos_base: 120,
        nivel_dificuldade: Math.min(5, (node.dificuldade || 3) + 1),
        exemplo_frase: node.exemplo_uso,
      };
    }

    if (node.tipo === 'expressao_idiomatica' || node.tipo === 'vocabulario') {
      return {
        id: `duel-q-${node.id}-${Date.now()}`,
        node_id: node.id,
        tipo: 'traducao',
        termo_principal: node.titulo,
        idioma_origem: idiomaAlvo,
        idioma_alvo: 'Português',
        pronuncia_ipa: node.pronuncia_ipa,
        dica_contextual: node.descricao,
        resposta_esperada: node.traducao || node.titulo,
        respostas_alternativas: this.extractKeywords(node.traducao || node.descricao),
        opcoes_multipla_escolha: this.generateDistractors(node),
        tempo_limite_segundos: 12,
        pontos_base: 100,
        nivel_dificuldade: node.dificuldade || 2,
        exemplo_frase: node.exemplo_uso,
      };
    }

    if (node.tipo === 'dificuldade') {
      return {
        id: `duel-q-${node.id}-${Date.now()}`,
        node_id: node.id,
        tipo: 'pronuncia_rapida',
        termo_principal: node.titulo,
        idioma_origem: idiomaAlvo,
        idioma_alvo: 'Português',
        pronuncia_ipa: node.pronuncia_ipa,
        dica_contextual: 'Desafio fonético: pronuncie com clareza e ritmo!',
        resposta_esperada: node.exemplo_uso || node.titulo,
        respostas_alternativas: [node.titulo, node.exemplo_uso || ''],
        tempo_limite_segundos: 15,
        pontos_base: 140,
        nivel_dificuldade: 4,
        exemplo_frase: node.exemplo_uso,
      };
    }

    return {
      id: `duel-q-${node.id}-${Date.now()}`,
      node_id: node.id,
      tipo: 'traducao',
      termo_principal: node.titulo,
      idioma_origem: idiomaAlvo,
      idioma_alvo: 'Português',
      pronuncia_ipa: node.pronuncia_ipa,
      dica_contextual: node.descricao,
      resposta_esperada: node.traducao || node.descricao,
      respostas_alternativas: this.extractKeywords(node.traducao || node.descricao),
      tempo_limite_segundos: 12,
      pontos_base: 100,
      nivel_dificuldade: 2,
      exemplo_frase: node.exemplo_uso,
    };
  },

  // Gera alternativas somente de termos já registrados no mesmo idioma.
  generateDistractors(targetNode: GraphNode): string[] {
    const correct = targetNode.traducao || targetNode.descricao || targetNode.titulo;
    const targetLanguage = getLanguageConfig(targetNode.idioma || 'ingles');
    const alternatives = StorageService.getNodes()
      .filter((node) => node.id !== targetNode.id && getLanguageConfig(node.idioma || 'ingles').id === targetLanguage.id)
      .map((node) => node.traducao || node.descricao || node.titulo)
      .filter((value) => value && value !== correct);

    if (alternatives.length === 0) return [];
    return Array.from(new Set([correct, ...alternatives])).slice(0, 4).sort(() => Math.random() - 0.5);
  },

  extractKeywords(text: string): string[] {
    if (!text) return [];
    const clean = this.normalizeAnswer(text);
    const parts = text
      .split(/[/|,;=]/)
      .map((p) => this.normalizeAnswer(p))
      .filter((p) => p.length >= 2);
    return Array.from(new Set([clean, ...parts]));
  },

  // Avalia a resposta do usuário (seja por texto ou fala transcrita)
  evaluateAnswer(
    question: DuelQuestion,
    userAnswer: string,
    timeLeftSeconds: number,
    isAudio: boolean = false,
    audioConfidence: number = 0.9
  ): DuelRoundAnswer {
    const normUser = this.normalizeAnswer(userAnswer);
    const normExpected = this.normalizeAnswer(question.resposta_esperada);
    const altNorms = question.respostas_alternativas.map((a) => this.normalizeAnswer(a)).filter(Boolean);

    let isCorrect = false;
    let accuracyPercent = 0;
    let feedback = '';

    if (!normUser) {
      return {
        question_id: question.id,
        resposta_usuario: '(Sem resposta / Tempo esgotado)',
        correta: false,
        tempo_gasto_segundos: question.tempo_limite_segundos - timeLeftSeconds,
        pontos_ganhos: 0,
        bonus_velocidade: 0,
        bonus_precisao: 0,
        precisao_porcentagem: 0,
        is_audio: isAudio,
        feedback: `Tempo esgotado! A resposta correta era: "${question.resposta_esperada}".`,
      };
    }

    // 1. Verificação de acerto direto exato
    if (normUser === normExpected || altNorms.includes(normUser)) {
      isCorrect = true;
      accuracyPercent = 100;
      feedback = 'Resposta exata e precisa!';
    } else {
      // 2. Cálculo de similaridade tokenizada estrita (Jaccard)
      const userTokens = new Set(normUser.split(' ').filter(Boolean));
      const expectedTokens = new Set(normExpected.split(' ').filter(Boolean));
      const intersection = new Set([...userTokens].filter((x) => expectedTokens.has(x)));
      const union = new Set([...userTokens, ...expectedTokens]);
      const jaccard = union.size > 0 ? intersection.size / union.size : 0;

      // Correspondência de alternativas com tokens
      let bestAltJaccard = 0;
      for (const alt of altNorms) {
        const altTokens = new Set(alt.split(' ').filter(Boolean));
        const altInter = new Set([...userTokens].filter((x) => altTokens.has(x)));
        const altUnion = new Set([...userTokens, ...altTokens]);
        const aj = altUnion.size > 0 ? altInter.size / altUnion.size : 0;
        if (aj > bestAltJaccard) bestAltJaccard = aj;
      }

      const effectiveSimilarity = Math.max(jaccard, bestAltJaccard);

      if (effectiveSimilarity >= 0.7 || (isAudio && audioConfidence >= 0.85 && effectiveSimilarity >= 0.55)) {
        isCorrect = true;
        accuracyPercent = Math.round(effectiveSimilarity * 100);
        feedback = 'Resposta aceita com boa aproximação!';
      } else {
        isCorrect = false;
        accuracyPercent = Math.round(effectiveSimilarity * 100);
        feedback = `Incorreto. A resposta esperada era: "${question.resposta_esperada}".`;
      }
    }

    // Cálculo da Pontuação
    let speedBonus = 0;
    let accuracyBonus = 0;
    let totalPoints = 0;

    if (isCorrect) {
      // Bônus de Velocidade: pontos proporcionais ao tempo restante
      speedBonus = Math.max(0, Math.round(timeLeftSeconds * 12));
      // Bônus de Precisão
      accuracyBonus = Math.round((accuracyPercent / 100) * 40);
      // Bônus adicional se respondeu em áudio
      const audioBonus = isAudio ? 30 : 0;

      totalPoints = question.pontos_base + speedBonus + accuracyBonus + audioBonus;
    }

    // Atualiza o nó no Grafo de Memória
    if (question.node_id) {
      this.updateNodeWithDuelResult(question.node_id, isCorrect, speedBonus > 50);
    }

    return {
      question_id: question.id,
      resposta_usuario: userAnswer,
      correta: isCorrect,
      tempo_gasto_segundos: Math.max(1, question.tempo_limite_segundos - timeLeftSeconds),
      pontos_ganhos: totalPoints,
      bonus_velocidade: speedBonus,
      bonus_precisao: accuracyBonus,
      precisao_porcentagem: accuracyPercent,
      is_audio: isAudio,
      score_pronuncia: isAudio ? Math.min(100, Math.round(audioConfidence * 100)) : undefined,
      feedback,
    };
  },

  // Reflete a vitória/derrota no nó correspondente do Grafo de Memória
  updateNodeWithDuelResult(nodeId: string, isCorrect: boolean, isFast: boolean): void {
    const nodes = StorageService.getNodes();
    const nodeIndex = nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = nodes[nodeIndex];
    const currentMastery = Math.max(0, node.dominio_estimado ?? 0);
    if (isCorrect) {
      const increment = isFast ? 12 : 8;
      node.dominio_estimado = Math.min(100, currentMastery + increment);
      node.frequencia_erro = Math.max(0, (node.frequencia_erro ?? 0) - 1);
      node.ultima_revisao = new Date().toISOString();
      node.proxima_revisao = new Date(Date.now() + 4 * 86400000).toISOString();
      node.evidencias = [
        `Acertou no Duelo de Vocabulário com resposta ${isFast ? 'ultra-rápida' : 'precisa'}`,
        ...(node.evidencias ?? []).slice(0, 4),
      ];
    } else {
      node.dominio_estimado = Math.max(0, currentMastery - 10);
      node.frequencia_erro = (node.frequencia_erro ?? 0) + 1;
      node.proxima_revisao = new Date().toISOString();
      node.evidencias = [
        'Errou termo no Duelo de Vocabulário (marcado para revisão espaçada prioritária)',
        ...(node.evidencias ?? []).slice(0, 4),
      ];
    }

    node.atualizado_em = new Date().toISOString();
    StorageService.saveNodes(nodes);
  },

  // Finaliza a sessão do duelo e computa XP total
  finishDuelSession(
    idioma: string,
    modo: 'misto' | 'audio' | 'texto',
    answers: DuelRoundAnswer[]
  ): { session: DuelGameSession; xpAwarded: number; updatedStats: UserStats } {
    const totalCorrect = answers.filter((a) => a.correta).length;
    const totalWrong = answers.length - totalCorrect;
    const totalScore = answers.reduce((sum, a) => sum + a.pontos_ganhos, 0);
    const totalTime = answers.reduce((sum, a) => sum + a.tempo_gasto_segundos, 0);

    // Calcula maior combo de acertos consecutivos
    let maxCombo = 0;
    let currentCombo = 0;
    for (const a of answers) {
      if (a.correta) {
        currentCombo++;
        if (currentCombo > maxCombo) maxCombo = currentCombo;
      } else {
        currentCombo = 0;
      }
    }

    // Bônus de XP com base na performance
    const xpBase = Math.round(totalScore / 10);
    const xpComboBonus = maxCombo * 15;
    const xpTotal = xpBase + xpComboBonus;

    const session: DuelGameSession = {
      id: `duel-session-${Date.now()}`,
      idioma,
      modo,
      questoes_totais: answers.length,
      acertos: totalCorrect,
      erros: totalWrong,
      pontuacao_total: totalScore,
      maior_combo: maxCombo,
      xp_ganho: xpTotal,
      tempo_total_segundos: totalTime,
      respostas: answers,
      data_sessao: new Date().toISOString(),
    };

    // Adiciona XP no StorageService
    const xpResult = StorageService.addXP(xpTotal);

    return {
      session,
      xpAwarded: xpTotal,
      updatedStats: xpResult.stats,
    };
  },

};
