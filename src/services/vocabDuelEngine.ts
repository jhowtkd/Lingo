import {
  DuelQuestion,
  DuelRoundAnswer,
  DuelGameSession,
  GraphNode,
  UserStats,
} from '../types';
import { StorageService } from './storage';
import { GraphEngine } from './graphEngine';

export const VocabDuelEngine = {
  // Normalizador de texto para comparação tolerante
  normalizeAnswer(text: string): string {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  },

  // Seleciona termos do Grafo de Memória e gera um lote de perguntas para o Duelo
  generateDuelQuestions(idiomaAlvo: string = 'Inglês', totalQuestions: number = 8): DuelQuestion[] {
    const nodes = StorageService.getNodes();
    const normIdioma = this.normalizeAnswer(idiomaAlvo);

    // Filtra nós relevantes para o idioma
    let relevantNodes = nodes.filter((n) => {
      const nLang = this.normalizeAnswer(n.idioma || 'ingles');
      return (
        nLang.includes(normIdioma) ||
        normIdioma.includes(nLang) ||
        (n.tipo === 'vocabulario' || n.tipo === 'falso_amigo' || n.tipo === 'expressao_idiomatica' || n.tipo === 'dificuldade')
      );
    });

    if (relevantNodes.length === 0) {
      relevantNodes = nodes;
    }

    // Ordena nós priorizando os com menor domínio ou maior frequência de erro
    const sortedNodes = [...relevantNodes].sort((a, b) => {
      const scoreA = (100 - (a.dominio_estimado || 50)) + (a.frequencia_erro || 0) * 15;
      const scoreB = (100 - (b.dominio_estimado || 50)) + (b.frequencia_erro || 0) * 15;
      return scoreB - scoreA;
    });

    const questions: DuelQuestion[] = [];
    const usedTitles = new Set<string>();

    for (const node of sortedNodes) {
      if (questions.length >= totalQuestions) break;
      if (usedTitles.has(node.titulo)) continue;
      usedTitles.add(node.titulo);

      const q = this.buildQuestionFromNode(node, idiomaAlvo);
      if (q) {
        questions.push(q);
      }
    }

    // Se faltarem perguntas, completa com itens temáticos de vocabulário
    if (questions.length < totalQuestions) {
      const fallbackQuestions = this.getFallbackQuestions(idiomaAlvo);
      for (const fq of fallbackQuestions) {
        if (questions.length >= totalQuestions) break;
        if (!usedTitles.has(fq.termo_principal)) {
          questions.push(fq);
          usedTitles.add(fq.termo_principal);
        }
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
        opcoes_multipla_escolha: this.generateDistractors(node, 'falso_amigo'),
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
        opcoes_multipla_escolha: this.generateDistractors(node, 'vocabulario'),
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

  // Gera opções de múltipla escolha com distratores convincentes
  generateDistractors(targetNode: GraphNode, tipo: string): string[] {
    const allNodes = StorageService.getNodes();
    const correct = targetNode.traducao || targetNode.titulo;
    const distractors: string[] = [correct];

    if (tipo === 'falso_amigo') {
      if (targetNode.titulo.includes('Actually')) {
        distractors.push('Atualmente / Nos dias de hoje', 'Acontecer de repente', 'Atuar no teatro');
      } else if (targetNode.titulo.includes('Pretend')) {
        distractors.push('Pretender / Ter a intenção de fazer', 'Proteger contra perigos', 'Apresentar um projeto');
      } else if (targetNode.titulo.includes('Push')) {
        distractors.push('Puxar para si', 'Pousar um objeto', 'Pintar uma parede');
      } else if (targetNode.titulo.includes('Borrow')) {
        distractors.push('Emprestar para alguém', 'Comprar fiado', 'Alugar uma casa');
      } else {
        distractors.push('Significado literal aparente', 'Opção inversa de sentido', 'Termo gramatical falso');
      }
    } else {
      // Pega traduções de outros nós do grafo
      const otherNodes = allNodes.filter((n) => n.id !== targetNode.id && n.traducao);
      for (const on of otherNodes) {
        if (distractors.length >= 4) break;
        if (on.traducao && !distractors.includes(on.traducao)) {
          distractors.push(on.traducao);
        }
      }
      while (distractors.length < 4) {
        distractors.push(`Definição contextual ${distractors.length}`);
      }
    }

    // Embaralha as 4 opções
    return distractors.sort(() => Math.random() - 0.5);
  },

  extractKeywords(text: string): string[] {
    if (!text) return [];
    const clean = this.normalizeAnswer(text);
    const words = clean.split(' ').filter((w) => w.length > 3);
    const parts = text.split(/[/|,;=]/).map((p) => this.normalizeAnswer(p)).filter(Boolean);
    return Array.from(new Set([clean, ...parts, ...words]));
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
    const altNorms = question.respostas_alternativas.map((a) => this.normalizeAnswer(a));

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

    // Verificação de acerto direto ou correspondência parcial
    if (normUser === normExpected || altNorms.includes(normUser)) {
      isCorrect = true;
      accuracyPercent = 100;
      feedback = 'Resposta exata e precisa!';
    } else {
      // Verifica se a resposta contém partes essenciais da resposta esperada
      const containsExpected = normExpected.length > 3 && (normUser.includes(normExpected) || normExpected.includes(normUser));
      const matchAlts = altNorms.some((alt) => alt.length > 3 && (normUser.includes(alt) || alt.includes(normUser)));

      if (containsExpected || matchAlts) {
        isCorrect = true;
        accuracyPercent = 85;
        feedback = 'Muito bom! Compreensão do significado confirmada.';
      } else {
        // Cálculo de similaridade simples (Jaccard token)
        const userTokens = new Set(normUser.split(' '));
        const expectedTokens = new Set(normExpected.split(' '));
        const intersection = new Set([...userTokens].filter((x) => expectedTokens.has(x)));
        const union = new Set([...userTokens, ...expectedTokens]);
        const jaccard = union.size > 0 ? intersection.size / union.size : 0;

        if (jaccard >= 0.4 || (isAudio && audioConfidence >= 0.8 && jaccard >= 0.3)) {
          isCorrect = true;
          accuracyPercent = Math.round(jaccard * 100);
          feedback = 'Resposta aceita com boa aproximação!';
        } else {
          isCorrect = false;
          accuracyPercent = Math.round(jaccard * 100);
          feedback = `Incorreto. A resposta esperada era: "${question.resposta_esperada}".`;
        }
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
    if (isCorrect) {
      const increment = isFast ? 12 : 8;
      node.dominio_estimado = Math.min(100, (node.dominio_estimado || 50) + increment);
      node.frequencia_erro = Math.max(0, (node.frequencia_erro || 0) - 1);
      node.ultima_revisao = new Date().toISOString();
      node.proxima_revisao = new Date(Date.now() + 4 * 86400000).toISOString();
      node.evidencias = [
        `Acertou no Duelo de Vocabulário com resposta ${isFast ? 'ultra-rápida' : 'precisa'}`,
        ...(node.evidencias || []).slice(0, 4),
      ];
    } else {
      node.dominio_estimado = Math.max(15, (node.dominio_estimado || 50) - 10);
      node.frequencia_erro = (node.frequencia_erro || 0) + 1;
      node.proxima_revisao = new Date().toISOString(); // Agendado para revisão imediata
      node.evidencias = [
        `Errou termo no Duelo de Vocabulário (marcado para revisão espaçada prioritária)`,
        ...(node.evidencias || []).slice(0, 4),
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

  // Perguntas de contingência para garantir variedade em múltiplos idiomas
  getFallbackQuestions(idioma: string): DuelQuestion[] {
    const norm = (idioma || '').toLowerCase();

    if (norm.includes('espanhol')) {
      return [
        {
          id: 'fb-es-1',
          tipo: 'falso_cognato',
          termo_principal: 'Embarazada',
          idioma_origem: 'Espanhol',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/embaɾaˈsaða/',
          dica_contextual: 'Falso amigo clássico! Não significa envergonhada.',
          resposta_esperada: 'Grávida / Gestante',
          respostas_alternativas: ['gravida', 'gestante'],
          opcoes_multipla_escolha: ['Grávida / Gestante', 'Envergonhada / Tímida', 'Embaraçada / Confusa', 'Atrasada'],
          tempo_limite_segundos: 12,
          pontos_base: 100,
          nivel_dificuldade: 2,
          exemplo_frase: 'Ella está embarazada de seis meses.',
        },
        {
          id: 'fb-es-2',
          tipo: 'traducao',
          termo_principal: 'Echar de menos',
          idioma_origem: 'Espanhol',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/eˈtʃaɾ ðe ˈmenos/',
          dica_contextual: 'Expressão idiomática de afeto e distância.',
          resposta_esperada: 'Sentir saudades / Sentir falta',
          respostas_alternativas: ['sentir saudades', 'sentir falta', 'saudade'],
          opcoes_multipla_escolha: ['Sentir saudades / Sentir falta', 'Desprezar alguém', 'Contar menos coisas', 'Desperdiçar comida'],
          tempo_limite_segundos: 12,
          pontos_base: 100,
          nivel_dificuldade: 2,
          exemplo_frase: 'Te echo mucho de menos cuando viajas.',
        },
        {
          id: 'fb-es-3',
          tipo: 'falso_cognato',
          termo_principal: 'Exquisito',
          idioma_origem: 'Espanhol',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/ekskiˈsito/',
          dica_contextual: 'Em culinária, é o maior elogio possível!',
          resposta_esperada: 'Delicioso / Muito saboroso',
          respostas_alternativas: ['delicioso', 'saboroso', 'muito bom', 'excelente'],
          opcoes_multipla_escolha: ['Delicioso / Muito saboroso', 'Estranho / Esquisito', 'Caro / Luxuoso', 'Raro / Incomum'],
          tempo_limite_segundos: 12,
          pontos_base: 120,
          nivel_dificuldade: 3,
          exemplo_frase: '¡La comida de este restaurante es exquisita!',
        },
        {
          id: 'fb-es-4',
          tipo: 'traducao',
          termo_principal: 'Vale la pena',
          idioma_origem: 'Espanhol',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/ˈbale la ˈpena/',
          dica_contextual: 'Expressão comum para incentivar uma ação recompensadora.',
          resposta_esperada: 'Vale a pena',
          respostas_alternativas: ['vale a pena', 'recompensa'],
          opcoes_multipla_escolha: ['Vale a pena', 'Custa caro', 'Dá muita tristeza', 'Não tem valor'],
          tempo_limite_segundos: 10,
          pontos_base: 90,
          nivel_dificuldade: 1,
          exemplo_frase: 'Aprender un nuevo idioma siempre vale la pena.',
        },
      ];
    }

    if (norm.includes('frances')) {
      return [
        {
          id: 'fb-fr-1',
          tipo: 'falso_cognato',
          termo_principal: 'Attendre',
          idioma_origem: 'Francês',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/a.tɑ̃dʁ/',
          dica_contextual: 'Não significa atender o telefone!',
          resposta_esperada: 'Esperar / Aguardar',
          respostas_alternativas: ['esperar', 'aguardar'],
          opcoes_multipla_escolha: ['Esperar / Aguardar', 'Atender ligação', 'Entender algo', 'Alcançar um objetivo'],
          tempo_limite_segundos: 12,
          pontos_base: 110,
          nivel_dificuldade: 3,
          exemplo_frase: "J'attends le bus depuis dix minutes.",
        },
        {
          id: 'fb-fr-2',
          tipo: 'traducao',
          termo_principal: 'Coup de foudre',
          idioma_origem: 'Francês',
          idioma_alvo: 'Português',
          pronuncia_ipa: '/ku də fudʁ/',
          dica_contextual: 'Expressão poética sobre amor instantâneo.',
          resposta_esperada: 'Amor à primeira vista',
          respostas_alternativas: ['amor a primeira vista', 'paixao repentina'],
          opcoes_multipla_escolha: ['Amor à primeira vista', 'Queda de raio', 'Golpe de sorte', 'Susto grande'],
          tempo_limite_segundos: 12,
          pontos_base: 120,
          nivel_dificuldade: 3,
          exemplo_frase: 'Quand ils se sont rencontrés, ce fut le coup de foudre.',
        },
      ];
    }

    // Inglês Padrão
    return [
      {
        id: 'fb-en-1',
        tipo: 'falso_cognato',
        termo_principal: 'Actually vs Currently',
        idioma_origem: 'Inglês',
        idioma_alvo: 'Português',
        pronuncia_ipa: '/ˈæk.tʃu.ə.li/',
        dica_contextual: 'Cuidado! Actually NÃO significa atualmente.',
        resposta_esperada: 'Na verdade / De fato',
        respostas_alternativas: ['na verdade', 'de fato', 'realmente'],
        opcoes_multipla_escolha: ['Na verdade / De fato', 'Atualmente / Hoje em dia', 'Acontecer no momento', 'Agir com firmeza'],
        tempo_limite_segundos: 12,
        pontos_base: 120,
        nivel_dificuldade: 3,
        exemplo_frase: 'Actually, I have never been to Canada.',
      },
      {
        id: 'fb-en-2',
        tipo: 'traducao',
        termo_principal: 'Hit the books',
        idioma_origem: 'Inglês',
        idioma_alvo: 'Português',
        pronuncia_ipa: '/hɪt ðə bʊks/',
        dica_contextual: 'Expressão idiomática estudantil muito comum.',
        resposta_esperada: 'Estudar com dedicação / Pegar firme nos livros',
        respostas_alternativas: ['estudar', 'pegar firme nos estudos', 'estudar muito'],
        opcoes_multipla_escolha: ['Estudar com dedicação', 'Bater nos livros fisicamente', 'Comprar livros usados', 'Vender anotações'],
        tempo_limite_segundos: 12,
        pontos_base: 100,
        nivel_dificuldade: 2,
        exemplo_frase: 'I have a big exam tomorrow, so I need to hit the books tonight.',
      },
      {
        id: 'fb-en-3',
        tipo: 'falso_cognato',
        termo_principal: 'Pretend vs Intend',
        idioma_origem: 'Inglês',
        idioma_alvo: 'Português',
        pronuncia_ipa: '/prɪˈtɛnd/',
        dica_contextual: 'Pretend NÃO é pretender.',
        resposta_esperada: 'Fingir / Fazer de conta',
        respostas_alternativas: ['fingir', 'fazer de conta'],
        opcoes_multipla_escolha: ['Fingir / Fazer de conta', 'Pretender / Ter intenção', 'Proteger alguém', 'Apresentar proposta'],
        tempo_limite_segundos: 12,
        pontos_base: 120,
        nivel_dificuldade: 3,
        exemplo_frase: "Don't pretend you didn't see the email.",
      },
      {
        id: 'fb-en-4',
        tipo: 'traducao',
        termo_principal: 'Break a leg',
        idioma_origem: 'Inglês',
        idioma_alvo: 'Português',
        pronuncia_ipa: '/breɪk ə lɛɡ/',
        dica_contextual: 'Desejo de sucesso no teatro e apresentações.',
        resposta_esperada: 'Boa sorte! / Arrase!',
        respostas_alternativas: ['boa sorte', 'arrase', 'sucesso'],
        opcoes_multipla_escolha: ['Boa sorte! / Arrase!', 'Quebrar a perna', 'Fracassar no palco', 'Fazer uma pausa rápida'],
        tempo_limite_segundos: 10,
        pontos_base: 100,
        nivel_dificuldade: 2,
        exemplo_frase: 'Break a leg at your presentation today!',
      },
    ];
  },
};
