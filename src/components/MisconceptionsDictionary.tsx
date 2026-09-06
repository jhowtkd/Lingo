import React, { useState, useEffect, useMemo } from 'react';
import {
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Volume2,
  Sparkles,
  Search,
  ArrowRight,
  Brain,
  Zap,
  Check,
  RotateCcw,
  MessageSquare,
  ChevronRight,
  TrendingDown,
  Clock,
  X,
  Plus,
} from 'lucide-react';
import { GraphNode, PedagogicalCorrection } from '../types';
import { StorageService } from '../services/storage';
import { GraphEngine } from '../services/graphEngine';
import { SpeechService } from '../services/speechSynthesisService';
import { getLanguageConfig } from '../config/languages';
import { CornerPlus } from './ui/corner-plus';

interface MisconceptionItem {
  id: string;
  nodeId?: string;
  correctionId?: string;
  titulo: string;
  categoria: 'falso_amigo' | 'vocabulario' | 'gramatica' | 'pronuncia' | 'equivoco';
  categoriaRotulo: string;
  idioma: string;
  usoIncorreto: string;
  usoCorreto: string;
  explicacaoPedagogica: string;
  porQueConfunde: string;
  exemplos: {
    frase: string;
    traducao: string;
    ipa?: string;
  }[];
  dicaMnemonica?: string;
  frequenciaErro: number;
  dominioEstimado: number;
  proximaRevisao: string;
  status: 'precisa_revisar' | 'pendente' | 'compreendido';
  gravidade: 'leve' | 'moderada' | 'critica';
  quiz?: {
    pergunta: string;
    opcoes: string[];
    respostaCorreta: string;
    explicacao: string;
  };
}

interface MisconceptionsDictionaryProps {
  onPracticeTopic: (topic: string) => void;
}

export const MisconceptionsDictionary: React.FC<MisconceptionsDictionaryProps> = ({
  onPracticeTopic,
}) => {
  const [items, setItems] = useState<MisconceptionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [selectedStatus, setSelectedStatus] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'frequencia' | 'dominio' | 'alfabetica'>('frequencia');
  const [selectedItem, setSelectedItem] = useState<MisconceptionItem | null>(null);

  // Estados do Mini-Quiz Interativo
  const [quizSelectedOption, setQuizSelectedOption] = useState<string | null>(null);
  const [quizSubmitted, setQuizSubmitted] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioFeedback, setAudioFeedback] = useState<string | null>(null);

  // Carrega e consolida nós do Grafo + Correções Pedagógicas
  const loadDictionaryData = () => {
    const nodes = StorageService.getNodes();
    const corrections = StorageService.getCorrections();

    const dictionaryList: MisconceptionItem[] = [];

    // Pré-processa correções 1x (antes: toLowerCase por par nó×correção)
    const normalizedCorrections = corrections.map((c) => ({
      c,
      normConceito: c.conceito.toLowerCase(),
    }));

    // 1. Processa nós do Grafo de Memória
    nodes.forEach((node) => {
      // Identifica nós que são equívocos, falsos amigos, dificuldades ou que possuem erros registrados
      const isMisconceptionNode =
        node.tipo === 'falso_amigo' ||
        node.tipo === 'equivoco' ||
        node.tipo === 'dificuldade' ||
        node.frequencia_erro > 0 ||
        node.titulo.includes('vs') ||
        node.titulo.toLowerCase().includes('collocation');

      if (isMisconceptionNode) {
        let categoria: MisconceptionItem['categoria'] = 'equivoco';
        let categoriaRotulo = 'Equívoco Conceitual';

        if (node.tipo === 'falso_amigo' || node.titulo.toLowerCase().includes('actually') || node.titulo.toLowerCase().includes('pretend') || node.titulo.toLowerCase().includes('push')) {
          categoria = 'falso_amigo';
          categoriaRotulo = 'Falso Cognato / Falso Amigo';
        } else if (node.tipo === 'vocabulario' || node.titulo.toLowerCase().includes('borrow') || node.titulo.toLowerCase().includes('homework') || node.titulo.toLowerCase().includes('ask a question')) {
          categoria = 'vocabulario';
          categoriaRotulo = 'Collocation & Léxico';
        } else if (node.tipo === 'gramatica' || node.titulo.toLowerCase().includes('present perfect') || node.titulo.toLowerCase().includes('in time')) {
          categoria = 'gramatica';
          categoriaRotulo = 'Gramática & Estrutura';
        } else if (node.tipo === 'dificuldade' || node.titulo.toLowerCase().includes('pronúncia') || node.titulo.toLowerCase().includes('-ed')) {
          categoria = 'pronuncia';
          categoriaRotulo = 'Pronúncia & Connected Speech';
        }

        // Tenta associar com correções gravadas
        const nodeTitleLower = node.titulo.toLowerCase();
        const matchedCorr = normalizedCorrections.find(
          ({ c, normConceito }) =>
            normConceito.includes(nodeTitleLower) ||
            nodeTitleLower.includes(normConceito) ||
            node.evidencias?.some((e) => e.includes(c.erro))
        )?.c;

        // Define exemplos contextuais ricos
        let exemplos = [
          {
            frase: node.exemplo_uso || `Correct usage example for ${node.titulo}`,
            traducao: node.traducao || 'Uso correto contextualizado',
            ipa: node.pronuncia_ipa,
          },
        ];

        let usoIncorreto = matchedCorr?.erro || 'Uso por tradução literal ou falso amigo.';
        let usoCorreto = matchedCorr?.resposta_corrigida || node.exemplo_uso || node.traducao || 'Padrão nativo do idioma.';
        let porQueConfunde = 'Interferência direta da estrutura do Português Brasileiro (L1) para o idioma alvo (L2).';
        let dicaMnemonica = matchedCorr?.dica_pronuncia_ou_gramatica || 'Lembre-se do contexto de uso e da intenção da frase.';

        // Customizações refinadas por nó para excelência pedagógica
        if (node.titulo.includes('Actually vs Atualmente')) {
          usoIncorreto = 'Dizer "Actually, I work as a developer" querendo dizer "Atualmente trabalho como desenvolvedor".';
          usoCorreto = 'Dizer "Currently, I work as a developer" (ou "Right now"). Use "Actually" apenas para "Na verdade".';
          porQueConfunde = 'A semelhança ortográfica com a palavra "atualmente" cria uma falsa correlação semântica imediata.';
          dicaMnemonica = 'Actually = Na verdade (Actualize a verdade). Currently = Corrente/Atual.';
          exemplos = [
            {
              frase: 'Actually, that is not what I meant.',
              traducao: 'Na verdade, não foi isso que eu quis dizer.',
              ipa: '/ˈæk.tʃu.ə.li/',
            },
            {
              frase: 'Currently, I am living in São Paulo.',
              traducao: 'Atualmente, estou morando em São Paulo.',
              ipa: '/ˈkʌr.ənt.li/',
            },
          ];
        } else if (node.titulo.includes('Pretend vs Intend')) {
          usoIncorreto = 'Dizer "I pretend to travel to Canada next summer" para dizer "Pretendo viajar ao Canadá".';
          usoCorreto = 'Dizer "I intend to travel to Canada" (ou "I plan to travel"). "Pretend" significa fingir!';
          porQueConfunde = 'O verbo "pretend" soa exatamente como o verbo "pretender" do português, mas tem sentido oposto (fingimento).';
          dicaMnemonica = 'Intend = Intenção (Intend tem som de Intenção). Pretend = "Pretexto / Fingimento".';
          exemplos = [
            {
              frase: 'I intend to start my Master degree next year.',
              traducao: 'Eu pretendo começar meu mestrado no ano que vem.',
              ipa: '/ɪnˈtɛnd/',
            },
            {
              frase: 'The children like to pretend they are superheroes.',
              traducao: 'As crianças gostam de fingir que são super-heróis.',
              ipa: '/prɪˈtɛnd/',
            },
          ];
        } else if (node.titulo.includes('Push vs Puxe')) {
          usoIncorreto = 'Puxar uma porta que tem a placa "PUSH" escrita.';
          usoCorreto = '"PUSH" é EMPURRAR. Para puxar, a palavra em inglês é "PULL".';
          porQueConfunde = 'A sonoridade de "Push" faz o cérebro brasileiro associar automaticamente à palavra "Puxe".';
          dicaMnemonica = 'Push tem som de "Puxe", então faça o CONTRÁRIO (Empurre). Pull = Puxe!';
          exemplos = [
            {
              frase: 'Push the green button to turn on the machine.',
              traducao: 'Empurre/aperte o botão verde para ligar a máquina.',
              ipa: '/pʊʃ/',
            },
            {
              frase: 'Pull the door towards you to open it.',
              traducao: 'Puxe a porta em sua direção para abri-la.',
              ipa: '/pʊl/',
            },
          ];
        } else if (node.titulo.includes('Borrow vs Lend')) {
          usoIncorreto = 'Dizer "Can you borrow me your pen?" (Você pode me pedir emprestado sua caneta?).';
          usoCorreto = 'Dizer "Can you lend me your pen?" OU "Can I borrow your pen?".';
          porQueConfunde = 'Em português usamos o mesmo verbo "emprestar" para ambas as direções da ação.';
          dicaMnemonica = 'Borrow FROM (Pegar de alguém). Lend TO (Dar a alguém). L = Levar para outro.';
          exemplos = [
            {
              frase: 'May I borrow your umbrella for today?',
              traducao: 'Posso pegar seu guarda-chuva emprestado por hoje?',
              ipa: '/ˈbɒr.əʊ/',
            },
            {
              frase: 'She lent her car to her brother.',
              traducao: 'Ela emprestou o carro para o irmão dela.',
              ipa: '/lɛnt/',
            },
          ];
        } else if (node.titulo.includes('In time vs On time')) {
          usoIncorreto = 'Usar "in time" para voos ou reuniões que saíram no horário exato do relógio.';
          usoCorreto = '"On time" é pontualidade britânica (no minuto marcado). "In time" é chegar antes do portão fechar.';
          porQueConfunde = 'Ambas as expressões são frequentemente traduzidas como "a tempo" ou "na hora" em português.';
          dicaMnemonica = 'On time = No ponteiro do relógio. In time = Dentro do prazo com folga.';
          exemplos = [
            {
              frase: 'The 8:00 train departed exactly on time.',
              traducao: 'O trem das 8h partiu exatamente no horário certo.',
              ipa: '/ɒn taɪm/',
            },
            {
              frase: 'We arrived in time to catch the sunset.',
              traducao: 'Chegamos a tempo de ver o pôr do sol.',
              ipa: '/ɪn taɪm/',
            },
          ];
        } else if (node.titulo.includes('Do Homework vs Make Homework')) {
          usoIncorreto = 'Dizer "I have to make my homework before class."';
          usoCorreto = 'Dizer "I have to do my homework." (tarefas e deveres levam "DO").';
          porQueConfunde = 'Em português usamos "fazer" tanto para tarefas (fazer lição) quanto para criações (fazer bolo).';
          dicaMnemonica = 'Do para deveres, tarefas e rotinas. Make para criar algo que não existia.';
          exemplos = [
            {
              frase: 'Always do your exercises carefully.',
              traducao: 'Sempre faça seus exercícios com atenção.',
              ipa: '/duː/',
            },
            {
              frase: 'She made a delicious chocolate cake.',
              traducao: 'Ela fez um delicioso bolo de chocolate.',
              ipa: '/meɪd/',
            },
          ];
        } else if (node.titulo.includes('Pronúncia do "-ed"')) {
          usoIncorreto = 'Pronunciar "worked" como "work-edji" ou "watched" como "watch-edji".';
          usoCorreto = 'Pronunciar como 1 sílaba: /wɜːkt/ (som de T mudo no final).';
          porQueConfunde = 'O português brasileiro não permite consoantes mudas em fim de sílaba sem adicionar a vogal [i].';
          dicaMnemonica = 'O "-ed" só vira som extra de sílaba (/ɪd/) se o verbo terminar em som de T ou D (wanted, decided).';
          exemplos = [
            {
              frase: 'She worked hard all night long.',
              traducao: 'Ela trabalhou duro a noite toda.',
              ipa: '/wɜːkt/',
            },
            {
              frase: 'They decided to travel to London.',
              traducao: 'Eles decidiram viajar para Londres.',
              ipa: '/dɪˈsaɪ.dɪd/',
            },
          ];
        } else if (node.titulo.includes('Ask a question')) {
          usoIncorreto = 'Dizer "Can I make a question?" por tradução de "fazer uma pergunta".';
          usoCorreto = 'Dizer "Can I ask a question?" (em inglês você pede/pergunta uma pergunta).';
          porQueConfunde = 'Tradução direta do verbo "fazer" do português.';
          dicaMnemonica = 'Nunca "make" a question. Sempre "ASK" a question.';
          exemplos = [
            {
              frase: 'Feel free to ask questions at any time.',
              traducao: 'Fique à vontade para fazer perguntas a qualquer momento.',
              ipa: '/æsk ə ˈkwɛs.tʃən/',
            },
          ];
        }

        // Determina status e severidade baseados nas métricas do Grafo
        let status: MisconceptionItem['status'] = 'pendente';
        if (node.dominio_estimado >= 75 && (matchedCorr?.estado_posterior === 'compreendido' || node.frequencia_erro <= 1)) {
          status = 'compreendido';
        } else if (node.dominio_estimado < 60 || node.frequencia_erro >= 2 || matchedCorr?.estado_posterior === 'precisa_revisar') {
          status = 'precisa_revisar';
        }

        let gravidade: MisconceptionItem['gravidade'] = 'moderada';
        if (node.frequencia_erro >= 3 || node.dificuldade >= 4) {
          gravidade = 'critica';
        } else if (node.dominio_estimado >= 80) {
          gravidade = 'leve';
        }

        // Configura quiz de validação pedagógica
        let quiz = matchedCorr?.pergunta_confirmacao
          ? {
              pergunta: matchedCorr.pergunta_confirmacao,
              opcoes: [
                node.traducao?.split('|')[0]?.trim() || 'Opção Correta',
                'Opção Incorreta Literal',
                'Uso ambíguo',
              ],
              respostaCorreta: node.traducao?.split('|')[0]?.trim() || 'Opção Correta',
              explicacao: matchedCorr.explicacao,
            }
          : undefined;

        if (node.titulo.includes('Actually')) {
          quiz = {
            pergunta: 'Como você diria naturalmente: "Atualmente, estou estudando para o teste"?',
            opcoes: [
              'Currently, I am studying for the test.',
              'Actually, I am studying for the test.',
              'Nowadays, I am studying at this moment.',
            ],
            respostaCorreta: 'Currently, I am studying for the test.',
            explicacao: '"Currently" refere-se a tempo presente ("atualmente"). "Actually" significa "na verdade".',
          };
        } else if (node.titulo.includes('Pretend')) {
          quiz = {
            pergunta: 'Qual a tradução correta da frase: "I intend to buy a new house"?',
            opcoes: [
              'Eu pretendo comprar uma casa nova.',
              'Eu finjo que comprei uma casa nova.',
              'Eu tentei comprar uma casa nova.',
            ],
            respostaCorreta: 'Eu pretendo comprar uma casa nova.',
            explicacao: '"Intend" é ter a intenção / pretender. "Pretend" é fingir.',
          };
        } else if (node.titulo.includes('Borrow vs Lend')) {
          quiz = {
            pergunta: 'Complete corretamente: "Could you please ___ me your notebook?"',
            opcoes: ['lend', 'borrow', 'borrowed'],
            respostaCorreta: 'lend',
            explicacao: 'Quando pedimos para outra pessoa dar algo emprestado a nós, usamos "lend" (dar emprestado).',
          };
        } else if (node.titulo.includes('Push vs Puxe')) {
          quiz = {
            pergunta: 'Você vê uma porta com a palavra "PUSH". O que você deve fazer?',
            opcoes: ['Empurrar a porta para a frente', 'Puxar a porta em sua direção', 'Bater na porta'],
            respostaCorreta: 'Empurrar a porta para a frente',
            explicacao: '"Push" significa empurrar. "Pull" é puxar!',
          };
        }

        dictionaryList.push({
          id: `misc-${node.id}`,
          nodeId: node.id,
          correctionId: matchedCorr?.id,
          titulo: node.titulo,
          categoria,
          categoriaRotulo,
          idioma: node.idioma || 'Inglês',
          usoIncorreto,
          usoCorreto,
          explicacaoPedagogica: matchedCorr?.explicacao || node.descricao,
          porQueConfunde,
          exemplos,
          dicaMnemonica,
          frequenciaErro: node.frequencia_erro ?? 0,
          dominioEstimado: node.dominio_estimado ?? 0,
          proximaRevisao: node.proxima_revisao || new Date().toISOString(),
          status,
          gravidade,
          quiz,
        });
      }
    });

    setItems(dictionaryList);
  };

  useEffect(() => {
    loadDictionaryData();
  }, []);

  // Filtros e busca reativos
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Busca textual
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matches =
            item.titulo.toLowerCase().includes(q) ||
            item.usoIncorreto.toLowerCase().includes(q) ||
            item.usoCorreto.toLowerCase().includes(q) ||
            item.explicacaoPedagogica.toLowerCase().includes(q) ||
            item.categoriaRotulo.toLowerCase().includes(q);
          if (!matches) return false;
        }

        // Categoria
        if (selectedCategory !== 'todos' && item.categoria !== selectedCategory) {
          return false;
        }

        // Status
        if (selectedStatus !== 'todos' && item.status !== selectedStatus) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'frequencia') {
          return b.frequenciaErro - a.frequenciaErro;
        }
        if (sortBy === 'dominio') {
          return a.dominioEstimado - b.dominioEstimado;
        }
        return a.titulo.localeCompare(b.titulo);
      });
  }, [items, searchQuery, selectedCategory, selectedStatus, sortBy]);

  // Estatísticas calculadas dinamicamente
  const stats = useMemo(() => {
    const total = items.length;
    const precisaRevisar = items.filter((i) => i.status === 'precisa_revisar').length;
    const compreendidos = items.filter((i) => i.status === 'compreendido').length;
    const avgDominio = total > 0 ? Math.round(items.reduce((acc, i) => acc + i.dominioEstimado, 0) / total) : 0;

    return { total, precisaRevisar, compreendidos, avgDominio };
  }, [items]);

  // Síntese de voz para pronúncia correta de exemplos
  const handleSpeakText = (text: string, language?: string) => {
    setIsSpeaking(true);
    setAudioFeedback('Reproduzindo pronúncia nativa natural...');

    const success = SpeechService.speak(text, {
      lang: getLanguageConfig(language || StorageService.getStats().idioma_ativo).ttsLocale,
      rate: 0.88,
      onStart: () => {
        setIsSpeaking(true);
        setAudioFeedback('Reproduzindo pronúncia nativa natural...');
      },
      onEnd: () => {
        setIsSpeaking(false);
        setAudioFeedback(null);
      },
      onError: () => {
        setIsSpeaking(false);
        setAudioFeedback(null);
      },
    });

    if (!success) {
      setIsSpeaking(false);
      setAudioFeedback('Síntese de voz não disponível.');
      setTimeout(() => setAudioFeedback(null), 2000);
    }
  };

  // Marcar como Compreendido e atualizar Grafo de Memória
  const handleMarkAsUnderstood = (item: MisconceptionItem) => {
    if (item.nodeId) {
      const nodes = StorageService.getNodes();
      const node = nodes.find((n) => n.id === item.nodeId);
      if (node) {
        node.dominio_estimado = Math.min(100, node.dominio_estimado + 20);
        node.frequencia_erro = Math.max(0, node.frequencia_erro - 1);
        node.ultima_revisao = new Date().toISOString();
        node.proxima_revisao = GraphEngine.calculateNextReview(node.dominio_estimado, node.frequencia_erro);
        StorageService.addOrUpdateNode(node);
      }
    }

    if (item.correctionId) {
      StorageService.updateCorrectionStatus(item.correctionId, 'compreendido', true);
    }

    StorageService.addXP(30);
    StorageService.recordAnswer(true, { topico: item.titulo, xp: 30 });

    // Recarrega
    loadDictionaryData();
    if (selectedItem && selectedItem.id === item.id) {
      setSelectedItem({
        ...selectedItem,
        status: 'compreendido',
        dominioEstimado: Math.min(100, selectedItem.dominioEstimado + 20),
      });
    }
  };

  // Submissão do Quiz Interativo
  const handleQuizSubmit = (item: MisconceptionItem) => {
    if (!quizSelectedOption || !item.quiz) return;
    setQuizSubmitted(true);

    const isCorrect = quizSelectedOption === item.quiz.respostaCorreta;
    if (isCorrect) {
      handleMarkAsUnderstood(item);
    } else {
      if (item.correctionId) {
        StorageService.updateCorrectionStatus(item.correctionId, 'precisa_revisar', false);
      }
    }
  };

  const resetQuiz = () => {
    setQuizSelectedOption(null);
    setQuizSubmitted(false);
  };

  return (
    <div className="relative view-card p-6 sm:p-8 space-y-7 text-left w-full">
      <CornerPlus />
      {/* Cabeçalho do Dicionário com Badges de Grafo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--fg)] text-[var(--accent)] flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              GM
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-bold font-display tracking-tight text-[var(--fg)]">
                  Dicionário Interativo de Equívocos Recorrentes
                </h3>
                <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)] uppercase">
                  MEMORY GRAPH
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[var(--muted)] mt-1">
                Mapeamento ativo de falsos cognatos, vícios de tradução literal e desvios fonéticos identificados pelo tutor.
              </p>
            </div>
          </div>
        </div>

        {/* Resumo de Métricas Rápidas */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="px-3.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center font-mono shadow-xs">
            <span className="text-[10px] uppercase font-extrabold text-rose-600 block">Revisões Urgentes</span>
            <span className="text-xs sm:text-sm font-bold text-[var(--fg)]">{stats.precisaRevisar} pendentes</span>
          </div>

          <div className="px-3.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center font-mono shadow-xs">
            <span className="text-[10px] uppercase font-extrabold text-emerald-600 block">Superados</span>
            <span className="text-xs sm:text-sm font-bold text-[var(--fg)]">{stats.compreendidos} itens</span>
          </div>

          <div className="px-3.5 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-xl text-center font-mono shadow-xs">
            <span className="text-[10px] uppercase font-extrabold text-[var(--muted)] block">Domínio Médio</span>
            <span className="text-xs sm:text-sm font-bold text-[var(--fg)]">{stats.avgDominio}%</span>
          </div>
        </div>
      </div>

        {/* Barra de Busca, Categorias e Filtros */}
        {items.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
            {/* Campo de Busca */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por termo, falso amigo, exemplo ou erro (ex: Actually, Pretend, Borrow)..."
                className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-lg text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Ordenação */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-mono text-muted-foreground hidden md:inline">ORDENAR:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                <option value="frequencia">Mais Recorrentes (Frequência)</option>
                <option value="dominio">Menor Domínio (Mais Urgentes)</option>
                <option value="alfabetica">Ordem Alfabética (A-Z)</option>
              </select>
            </div>
            </div>

            {/* Chips de Categorias e Filtro de Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            {/* Categorias */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'todos', label: 'Todos os Equívocos' },
                { id: 'falso_amigo', label: 'Falsos Cognatos' },
                { id: 'vocabulario', label: 'Collocations & Léxico' },
                { id: 'gramatica', label: 'Gramática & Estrutura' },
                { id: 'pronuncia', label: 'Pronúncia & Fonética' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-foreground text-background font-semibold shadow-2xs'
                      : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted border border-border'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Filtro de Status */}
            <div className="flex items-center space-x-1.5 text-xs text-muted-foreground font-mono">
              <span>STATUS:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              >
                <option value="todos">Todos os Status</option>
                <option value="precisa_revisar">🔴 Precisa Revisar</option>
                <option value="pendente">🟡 Em Consolidação</option>
                <option value="compreendido">🟢 Superados</option>
              </select>
            </div>
            </div>
          </div>
        )}

        {/* Grid de Cards Interativos do Dicionário */}
        {items.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-[var(--r-md)] space-y-3">
            <BookOpen className="w-8 h-8 text-[var(--muted)] mx-auto" />
            <p className="text-sm font-semibold text-[var(--fg)]">
              Nenhum equívoco foi registrado ainda
            </p>
            <p className="text-xs text-[var(--muted)] max-w-md mx-auto">
              As correções aparecem aqui depois que o tutor identifica e registra uma dificuldade real.
            </p>
            <button
              type="button"
              onClick={() => onPracticeTopic('Conversação livre')}
              className="rounded-full px-4 py-2 text-xs font-extrabold bg-[var(--accent)] text-[var(--fg)]"
            >
              Praticar com o tutor
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-[var(--border)] rounded-[var(--r-md)] space-y-2">
            <BookOpen className="w-8 h-8 text-[var(--muted)] mx-auto" />
            <p className="text-sm font-semibold text-[var(--fg)]">Nenhum equívoco encontrado para este filtro.</p>
            <p className="text-xs text-[var(--muted)]">
              Conforme você conversa com o tutor na aba de Chat, novos desvios e correções serão registrados automaticamente no seu Grafo.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredItems.map((item) => {
              const isNeedReview = item.status === 'precisa_revisar';
              const isMastered = item.status === 'compreendido';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedItem(item);
                    resetQuiz();
                  }}
                  className={`p-4 rounded-[var(--r-md)] border transition cursor-pointer text-left flex flex-col justify-between group relative shadow-xs hover:border-[var(--fg)]/40 ${
                    isNeedReview
                      ? 'bg-rose-500/5 border-rose-500/30'
                      : isMastered
                      ? 'bg-[var(--mint)] border-[var(--ok)]/30'
                      : 'bg-[var(--surface)] border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)]'
                  }`}
                >
                  <div>
                    {/* Topo do Card: Categoria & Badge de Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-[var(--border)] bg-[oklch(0.96_0.01_84)] text-[var(--muted)]">
                        {item.categoriaRotulo}
                      </span>

                    <div className="flex items-center space-x-1.5">
                      {isNeedReview && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          Revisar ({item.frequenciaErro}x)
                        </span>
                      )}
                      {isMastered && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--ok)] bg-[var(--mint)] px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-[var(--ok)]" />
                          Superado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Título do Equívoco */}
                  <h4 className="text-sm font-display font-bold text-[var(--fg)] group-hover:text-[var(--accent-deep)] transition flex items-center justify-between">
                    <span>{item.titulo}</span>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)] group-hover:translate-x-1 transition" />
                  </h4>

                  {/* Comparativo Rápido ❌ vs ✅ */}
                  <div className="space-y-1.5 mt-2.5 text-xs">
                    <div className="p-2 rounded-lg bg-rose-50/80 border border-rose-100/80 text-rose-900 flex items-start space-x-1.5">
                      <span className="text-rose-500 font-bold shrink-0">❌</span>
                      <p className="line-clamp-2 text-[11px] leading-tight font-medium">
                        {item.usoIncorreto}
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-[var(--mint)] border border-[var(--ok)]/30 text-[var(--fg)] flex items-start space-x-1.5">
                      <span className="text-[var(--ok)] font-bold shrink-0">✅</span>
                      <p className="line-clamp-2 text-[11px] leading-tight font-semibold">
                        {item.usoCorreto}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card: Barra de Domínio & Ação */}
                <div className="mt-3.5 pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2">
                    <span className="text-[11px] text-[var(--muted)] font-medium">Domínio:</span>
                    <div className="w-16 bg-[oklch(0.94_0.01_84)] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          item.dominioEstimado >= 75
                            ? 'bg-[var(--ok)]'
                            : item.dominioEstimado >= 50
                            ? 'bg-[var(--sunny)]'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${item.dominioEstimado}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold font-mono text-[var(--fg)]">{item.dominioEstimado}%</span>
                  </div>

                  <span className="text-[11px] text-[var(--fg)] font-bold group-hover:underline flex items-center gap-0.5">
                    Ver Explicação ➔
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Interativo Detalhado de Explicação Pedagógica & Exemplos de Uso */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-[var(--fg)]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] max-w-2xl w-full p-5 sm:p-7 space-y-5 shadow-xl text-[var(--fg)] max-h-[90vh] overflow-y-auto">
            {/* Topo do Modal */}
            <div className="flex items-start justify-between border-b border-[var(--border)] pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--border)] bg-[oklch(0.96_0.01_84)] text-[var(--fg)] font-mono"
                  >
                    {selectedItem.categoriaRotulo}
                  </span>
                  <span className="text-xs text-[var(--muted)] font-medium">
                    Idioma: {selectedItem.idioma}
                  </span>
                </div>
                <h3 className="text-lg sm:text-xl font-display font-bold text-[var(--fg)] mt-1">
                  {selectedItem.titulo}
                </h3>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-[var(--muted)] hover:text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] rounded-full transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Comparativo Visual Amplo: ❌ Equívoco vs ✅ Padrão Nativo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* O Equívoco */}
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-1 text-left">
                <span className="text-[11px] uppercase font-bold text-rose-700 flex items-center gap-1">
                  <span>❌</span> Armadilha / Uso Incorreto
                </span>
                <p className="text-xs sm:text-sm font-medium text-rose-950 leading-relaxed">
                  {selectedItem.usoIncorreto}
                </p>
              </div>

              {/* A Solução Nativa */}
              <div className="p-3.5 bg-[var(--mint)] border border-[var(--ok)]/30 rounded-2xl space-y-1 text-left">
                <span className="text-[11px] uppercase font-bold text-[var(--ok)] flex items-center gap-1">
                  <span>✅</span> Forma Correta & Padrão Nativo
                </span>
                <p className="text-xs sm:text-sm font-bold text-[var(--fg)] leading-relaxed">
                  {selectedItem.usoCorreto}
                </p>
              </div>
            </div>

            {/* Explicação Pedagógica & Por Que o Cérebro Confunde */}
            <div className="space-y-3 text-left">
              <div className="p-4 bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-2xl space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)] flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                  Explicação Pedagógica & Modelo Mental
                </h4>
                <p className="text-xs sm:text-sm text-[var(--muted)] leading-relaxed">
                  {selectedItem.explicacaoPedagogica}
                </p>

                {selectedItem.porQueConfunde && (
                  <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--muted)]">
                    <strong className="text-[var(--fg)]">Por que ocorre essa confusão? </strong>
                    {selectedItem.porQueConfunde}
                  </div>
                )}
              </div>

              {/* Dica Mnemônica */}
              {selectedItem.dicaMnemonica && (
                <div className="p-3 bg-[var(--sunny)]/15 border border-[var(--sunny)]/40 rounded-2xl flex items-start space-x-2.5 text-xs text-[var(--fg)]">
                  <Zap className="w-4 h-4 text-[var(--fg)] shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Macete / Dica de Ouro: </strong>
                    <span>{selectedItem.dicaMnemonica}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Exemplos Práticos de Uso no Cotidiano (com Áudio TTS) */}
            <div className="space-y-2.5 text-left">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--fg)] flex items-center gap-1.5 font-mono">
                  <BookOpen className="w-3.5 h-3.5 text-[var(--accent-deep)]" />
                  Exemplos de Uso no Cotidiano
                </h4>
                {audioFeedback && (
                  <span className="text-[11px] text-[var(--accent-deep)] font-semibold animate-pulse font-mono">
                    {audioFeedback}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                {selectedItem.exemplos.map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[var(--surface)] border border-[var(--border)] rounded-2xl flex items-center justify-between gap-3 shadow-xs hover:border-[var(--fg)]/30 transition"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs sm:text-sm font-bold text-[var(--fg)]">
                          {ex.frase}
                        </span>
                        {ex.ipa && (
                          <span className="text-[11px] font-mono text-[var(--muted)] bg-[oklch(0.96_0.01_84)] px-1.5 py-0.5 rounded">
                            {ex.ipa}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)]">{ex.traducao}</p>
                    </div>

                    <button
                      onClick={() => handleSpeakText(ex.frase, selectedItem.idioma)}
                      disabled={isSpeaking}
                      className="p-2 text-[var(--fg)] hover:bg-[oklch(0.96_0.01_84)] rounded-full transition cursor-pointer shrink-0"
                      title="Ouvir pronúncia nativa com Web Speech TTS"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Mini-Quiz Interativo de Fixação Rápida */}
            {selectedItem.quiz && (
              <div className="p-4 bg-[oklch(0.97_0.01_84)] border border-[var(--border)] rounded-2xl space-y-3 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--fg)] flex items-center gap-1.5 font-mono">
                    <HelpCircle className="w-4 h-4 text-[var(--accent-deep)]" />
                    Teste Rápido de Fixação (+30 XP)
                  </span>
                  {quizSubmitted && (
                    <span className="text-xs font-bold text-[var(--fg)] font-mono">
                      {quizSelectedOption === selectedItem.quiz.respostaCorreta
                        ? '🎉 Parabéns! Correto!'
                        : '❌ Quase! Veja a explicação.'}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm font-semibold text-[var(--fg)]">
                  {selectedItem.quiz.pergunta}
                </p>

                <div className="space-y-1.5">
                  {selectedItem.quiz.opcoes.map((opcao, idx) => {
                    const isSelected = quizSelectedOption === opcao;
                    const isCorrect = opcao === selectedItem.quiz?.respostaCorreta;
                    let optionStyle = 'bg-[var(--surface)] border-[var(--border)] hover:bg-[oklch(0.96_0.01_84)] text-[var(--fg)]';

                    if (quizSubmitted) {
                      if (isCorrect) {
                        optionStyle = 'bg-[var(--mint)] border-[var(--ok)] text-[var(--ok)] font-bold';
                      } else if (isSelected && !isCorrect) {
                        optionStyle = 'bg-rose-100 border-rose-300 text-rose-900 line-through';
                      }
                    } else if (isSelected) {
                      optionStyle = 'bg-[var(--fg)] text-[var(--accent)] border-[var(--fg)] font-semibold';
                    }

                    return (
                      <button
                        key={idx}
                        disabled={quizSubmitted}
                        onClick={() => setQuizSelectedOption(opcao)}
                        className={`w-full p-2.5 rounded-full border text-left text-xs sm:text-sm transition flex items-center justify-between cursor-pointer ${optionStyle}`}
                      >
                        <span>{opcao}</span>
                        {quizSubmitted && isCorrect && <Check className="w-4 h-4 text-[var(--ok)] shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {!quizSubmitted ? (
                  <button
                    onClick={() => handleQuizSubmit(selectedItem)}
                    disabled={!quizSelectedOption}
                    className="w-full py-2.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 disabled:opacity-50 text-[var(--bg)] rounded-full text-xs font-semibold transition cursor-pointer shadow-xs"
                  >
                    Confirmar Resposta
                  </button>
                ) : (
                  <p className="text-xs text-[var(--muted)] bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--border)]">
                    <strong className="text-[var(--fg)]">Explicação: </strong>
                    {selectedItem.quiz.explicacao}
                  </p>
                )}
              </div>
            )}

            {/* Rodapé de Ações do Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--border)]">
              <button
                onClick={() => {
                  handleMarkAsUnderstood(selectedItem);
                  setSelectedItem(null);
                }}
                className="px-4 py-2.5 bg-[var(--ok)] hover:bg-[var(--ok)]/90 text-white rounded-full text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Marcar como Superado no Grafo</span>
              </button>

              <button
                onClick={() => {
                  onPracticeTopic(selectedItem.titulo);
                  setSelectedItem(null);
                }}
                className="px-4 py-2.5 bg-[var(--fg)] hover:bg-[var(--fg)]/90 text-[var(--bg)] rounded-full text-xs font-semibold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Praticar no Chat com Tutor ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
