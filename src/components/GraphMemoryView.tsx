import React, { useState, useEffect, useMemo } from 'react';
import {
  Network,
  Plus,
  Trash2,
  Search,
  Filter,
  AlertCircle,
  CheckCircle2,
  BookOpen,
  HelpCircle,
  Clock,
  ArrowRight,
  Sparkles,
  Edit2,
  Eye,
  Info,
  LayoutGrid,
} from 'lucide-react';
import { GraphNode, GraphRelation, NodeType } from '../types';
import { StorageService } from '../services/storage';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { SectionHeader } from './ui/section-header';
import { BorderTrail } from './ui/border-trail';
import { GraphTopologyCanvas } from './GraphTopologyCanvas';

export const GraphMemoryView: React.FC = () => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [relations, setRelations] = useState<GraphRelation[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'topology'>('topology');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('todos');
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isCreatingNode, setIsCreatingNode] = useState(false);

  // Rastreamento de novos nós e conexões adicionados durante esta sessão
  const [sessionNewNodeIds, setSessionNewNodeIds] = useState<Set<string>>(() => {
    // Inicializa com nós criados nas últimas 24h ou marcados recentemente
    return new Set<string>();
  });
  const [sessionNewRelationIds, setSessionNewRelationIds] = useState<Set<string>>(() => {
    return new Set<string>();
  });

  // Form para novo nó
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<NodeType>('conceito');
  const [newDominio, setNewDominio] = useState(70);
  const [newDifficulty, setNewDifficulty] = useState(3);

  const loadGraph = () => {
    const loadedNodes = StorageService.getNodes();
    const loadedRelations = StorageService.getRelations();
    setNodes(loadedNodes);
    setRelations(loadedRelations);

    // Se a sessão acabou de abrir e não temos itens marcados, destaca nós adicionados/modificados hoje
    if (sessionNewNodeIds.size === 0 && loadedNodes.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const recentIds = new Set<string>();
      loadedNodes.forEach((n) => {
        if (n.criado_em?.startsWith(today) || n.atualizado_em?.startsWith(today)) {
          recentIds.add(n.id);
        }
      });
      setSessionNewNodeIds(recentIds);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  const handleDeleteNode = (id: string, title: string) => {
    if (window.confirm(`Deseja realmente excluir a memória "${title}" do seu grafo? Esta ação removerá também as relações conectadas a este nó.`)) {
      StorageService.deleteNode(id);
      loadGraph();
      if (selectedNode?.id === id) {
        setSelectedNode(null);
      }
      setSessionNewNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleCreateNode = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const now = new Date().toISOString();
    const newId = `node-${Date.now()}`;
    const created: GraphNode = {
      id: newId,
      tipo: newType,
      titulo: newTitle.trim(),
      descricao: newDesc.trim() || `Registro manual de ${newTitle}`,
      dominio_estimado: newDominio,
      dificuldade: newDifficulty,
      frequencia_erro: newType === 'dificuldade' || newType === 'equivoco' ? 1 : 0,
      ultima_revisao: now,
      proxima_revisao: new Date(Date.now() + 3 * 86400000).toISOString(),
      evidencias: ['Criado manualmente pelo estudante no painel de memória nesta sessão'],
      criado_em: now,
      atualizado_em: now,
    };

    StorageService.addOrUpdateNode(created);

    // Conecta automaticamente a um tópico pai se existir
    const topicNode = nodes.find((n) => n.tipo === 'topico');
    if (topicNode) {
      const newRelId = `rel-${Date.now()}`;
      const newRel: GraphRelation = {
        id: newRelId,
        origem_id: newId,
        destino_id: topicNode.id,
        tipo: 'relacionado_a',
        peso: 0.85,
        criado_em: now,
      };
      StorageService.addRelation(newRel);
      setSessionNewRelationIds((prev) => new Set([...prev, newRelId]));
    }

    // Registra como novo nesta sessão para ativar o efeito BorderTrail
    setSessionNewNodeIds((prev) => new Set([...prev, newId]));

    loadGraph();
    setIsCreatingNode(false);
    setNewTitle('');
    setNewDesc('');
  };

  const handleUpdateMastery = (node: GraphNode, delta: number) => {
    const updated: GraphNode = {
      ...node,
      dominio_estimado: Math.max(0, Math.min(100, node.dominio_estimado + delta)),
      atualizado_em: new Date().toISOString(),
    };
    StorageService.addOrUpdateNode(updated);
    loadGraph();
    if (selectedNode?.id === node.id) {
      setSelectedNode(updated);
    }
  };

  // Filtragem
  const filteredNodes = useMemo(() => {
    return nodes.filter((n) => {
      const matchesSearch =
        n.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.descricao.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'todos' || n.tipo === filterType;
      return matchesSearch && matchesType;
    });
  }, [nodes, searchQuery, filterType]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const selectedRelations = useMemo(() => {
    if (!selectedNode) return [];
    return relations.filter(
      (r) => r.origem_id === selectedNode.id || r.destino_id === selectedNode.id
    );
  }, [relations, selectedNode]);

  const getTypeBadge = (type: NodeType) => {
    switch (type) {
      case 'topico':
        return { label: 'Tópico', bg: 'bg-muted/80 text-foreground border-border' };
      case 'conceito':
        return { label: 'Conceito', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      case 'dificuldade':
        return { label: 'Dificuldade', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      case 'equivoco':
        return { label: 'Equívoco', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      case 'objetivo_aprendizagem':
        return { label: 'Objetivo', bg: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30' };
      case 'anotacao':
        return { label: 'Anotação', bg: 'bg-muted text-muted-foreground border-border' };
      case 'vocabulario':
        return { label: 'Vocabulário', bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30' };
      case 'gramatica':
        return { label: 'Gramática', bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30' };
      case 'falso_amigo':
        return { label: 'Falso Cognato', bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30' };
      default:
        return { label: 'Registro', bg: 'bg-muted text-muted-foreground border-border' };
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 text-left">
      {/* Cabeçalho */}
      <div className="relative view-card p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <CornerPlus />
        <div>
          <div className="flex items-center space-x-2">
            <div className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-[10px] font-bold text-[var(--muted)] uppercase">
              KNOWLEDGE GRAPH & MEMORY
            </div>
            {sessionNewNodeIds.size > 0 && (
              <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--accent)] px-2.5 py-0.5 font-mono text-[10px] font-extrabold text-[var(--fg)]">
                <Sparkles className="w-3 h-3 text-amber-600" />
                <span>{sessionNewNodeIds.size} NOVO(S) NA SESSÃO</span>
              </div>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-[var(--fg)] mt-1.5">
            Memória em Grafo de Conhecimento
          </h2>
          <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 max-w-2xl leading-relaxed">
            Acompanhamento relacional de conceitos, dificuldades, equívocos e repetição espaçada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Seletor de Modo de Visualização */}
          <div className="flex items-center bg-muted border border-border rounded-lg p-1 font-mono text-xs">
            <button
              onClick={() => setViewMode('topology')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-bold ${
                viewMode === 'topology'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Network className="w-3.5 h-3.5" />
              <span>Grafo Visual</span>
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md transition cursor-pointer font-bold ${
                viewMode === 'grid'
                  ? 'bg-foreground text-background shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Grade / Lista</span>
            </button>
          </div>

          <Button
            onClick={() => setIsCreatingNode(true)}
            size="sm"
            className="gap-1.5 font-mono text-xs cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Registro</span>
          </Button>
        </div>
      </div>

      {/* RENDERIZAÇÃO CONDICIONAL POR MODO DE VISUALIZAÇÃO */}
      {viewMode === 'topology' ? (
        <GraphTopologyCanvas
          nodes={nodes}
          relations={relations}
          sessionNewNodeIds={sessionNewNodeIds}
          sessionNewRelationIds={sessionNewRelationIds}
          selectedNode={selectedNode}
          onSelectNode={setSelectedNode}
          onUpdateMastery={handleUpdateMastery}
          getTypeBadge={getTypeBadge}
        />
      ) : (
        <div className="space-y-4">
          {/* Controles de Busca e Filtro */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por título, descrição ou palavra-chave..."
                className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs font-mono"
              />
            </div>

            <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'topico', label: 'Tópicos' },
                { id: 'conceito', label: 'Conceitos' },
                { id: 'vocabulario', label: 'Vocabulário' },
                { id: 'gramatica', label: 'Gramática' },
                { id: 'falso_amigo', label: 'Falsos Cognatos' },
                { id: 'dificuldade', label: 'Dificuldades' },
                { id: 'equivoco', label: 'Equívocos' },
                { id: 'objetivo_aprendizagem', label: 'Objetivos' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterType(f.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium whitespace-nowrap transition cursor-pointer ${
                    filterType === f.id
                      ? 'bg-foreground text-background font-semibold shadow-2xs'
                      : 'bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid de Nós da Memória com Efeito BorderTrail nos novos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredNodes.map((node) => {
              const badge = getTypeBadge(node.tipo);
              const isPendingReview = new Date(node.proxima_revisao) <= new Date();
              const isNewInSession = sessionNewNodeIds.has(node.id);

              return (
                <div
                  key={node.id}
                  className={`relative bg-card border rounded-lg p-4 transition-all duration-200 hover:border-border/80 shadow-2xs flex flex-col justify-between space-y-3 font-mono ${
                    isPendingReview
                      ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                      : isNewInSession
                      ? 'border-foreground/80 shadow-md ring-1 ring-foreground/20'
                      : 'border-border'
                  } ${isNewInSession ? 'overflow-hidden' : ''}`}
                >
                  <CornerPlus size="size-3" />

                  {/* DESTAQUE BORDERTRAIL PARA NÓS ADICIONADOS NA SESSÃO */}
                  {isNewInSession && (
                    <BorderTrail
                      size={85}
                      transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                      style={{
                        boxShadow:
                          '0px 0px 50px 25px rgb(255 255 255 / 45%), 0 0 80px 45px rgb(0 0 0 / 35%)',
                      }}
                    />
                  )}

                  <div>
                    {/* Header do Card */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-1.5">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badge.bg}`}>
                          {badge.label}
                        </span>
                        {isNewInSession && (
                          <span className="flex items-center space-x-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-foreground text-background shadow-2xs">
                            <Sparkles className="w-2.5 h-2.5" />
                            <span>NOVO NA SESSÃO</span>
                          </span>
                        )}
                      </div>

                      {isPendingReview && (
                        <span className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse">
                          <Clock className="w-3 h-3" />
                          <span>Revisão</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-sm text-foreground line-clamp-1 tracking-tight">
                      {node.titulo}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {node.descricao}
                    </p>
                  </div>

                  {/* Métricas do Nó: Domínio e Erros */}
                  <div className="space-y-2 pt-2 border-t border-border text-xs">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Domínio Estimado:</span>
                      <span className="font-bold text-foreground">{node.dominio_estimado}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          node.dominio_estimado >= 80
                            ? 'bg-emerald-500'
                            : node.dominio_estimado >= 55
                            ? 'bg-foreground'
                            : 'bg-amber-500'
                        }`}
                        style={{ width: `${node.dominio_estimado}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                      <span>Erros: {node.frequencia_erro}x</span>
                      <span>
                        Rev: {new Date(node.proxima_revisao).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      onClick={() => setSelectedNode(node)}
                      className="text-xs text-foreground hover:underline font-medium flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Detalhes</span>
                    </button>

                    <button
                      onClick={() => handleDeleteNode(node.id, node.titulo)}
                      className="p-1.5 text-muted-foreground hover:text-rose-500 rounded hover:bg-muted transition cursor-pointer"
                      title="Excluir memória"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredNodes.length === 0 && (
            <div className="relative text-center py-12 bg-card border border-border rounded-lg text-muted-foreground space-y-2 shadow-2xs font-mono">
              <CornerPlus />
              <Info className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-semibold text-foreground">Nenhum registro encontrado no grafo.</p>
              <p className="text-xs text-muted-foreground">
                Converse com o tutor pedagógico para extrair conceitos automaticamente ou crie um manualmente.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Detalhes do Nó e Relações */}
      {selectedNode && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-card border border-border rounded-lg max-w-2xl w-full p-6 space-y-5 shadow-xl overflow-y-auto max-h-[90vh] text-card-foreground">
            <CornerPlus />
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center space-x-2">
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                    getTypeBadge(selectedNode.tipo).bg
                  }`}
                >
                  {getTypeBadge(selectedNode.tipo).label}
                </span>
                <h3 className="text-base font-bold tracking-tight text-foreground">{selectedNode.titulo}</h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground hover:text-foreground text-base font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm font-mono">
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">Descrição:</span>
                <p className="text-foreground mt-1 bg-muted/30 p-3 rounded-lg border border-border">
                  {selectedNode.descricao}
                </p>
              </div>

              {/* Ajuste Manual de Domínio */}
              <div className="bg-muted/30 p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground font-semibold">Domínio de Aprendizagem:</span>
                  <span className="text-xs font-mono font-bold text-foreground">
                    {selectedNode.dominio_estimado}%
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateMastery(selectedNode, -10)}
                    className="text-xs cursor-pointer"
                  >
                    -10%
                  </Button>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={selectedNode.dominio_estimado}
                    onChange={(e) =>
                      handleUpdateMastery(selectedNode, Number(e.target.value) - selectedNode.dominio_estimado)
                    }
                    className="flex-1 accent-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleUpdateMastery(selectedNode, 10)}
                    className="text-xs cursor-pointer"
                  >
                    +10%
                  </Button>
                </div>
              </div>

              {/* Evidências Registradas na Conversa */}
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Evidências Registradas na Conversa:
                </span>
                <div className="mt-1 space-y-1.5">
                  {selectedNode.evidencias && selectedNode.evidencias.length > 0 ? (
                    selectedNode.evidencias.map((ev, idx) => (
                      <div
                        key={idx}
                        className="bg-muted/30 p-2.5 rounded-lg border border-border text-xs text-foreground italic"
                      >
                        "{ev}"
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">Nenhuma evidência textual registrada.</p>
                  )}
                </div>
              </div>

              {/* Relações no Grafo */}
              <div>
                <span className="text-xs text-muted-foreground uppercase font-semibold">
                  Relações Conectadas no Grafo:
                </span>
                <div className="mt-1 space-y-2">
                  {selectedRelations
                    .map((r) => {
                      const otherId = r.origem_id === selectedNode.id ? r.destino_id : r.origem_id;
                      const otherNode = nodeById.get(otherId);
                      const isOrigin = r.origem_id === selectedNode.id;

                      return (
                        <div
                          key={r.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border text-xs text-foreground"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-foreground">
                              {isOrigin ? `[${r.tipo}]` : `[inverso: ${r.tipo}]`}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="font-medium text-foreground">
                              {otherNode?.titulo || 'Outro Nó'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono">Peso: {r.peso}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-border">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDeleteNode(selectedNode.id, selectedNode.titulo)}
                className="gap-1 font-mono text-xs cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Excluir Memória</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedNode(null)}
                className="font-mono text-xs cursor-pointer"
              >
                Fechar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Criação Manual de Nó */}
      {isCreatingNode && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateNode}
            className="relative bg-card border border-border rounded-lg max-w-lg w-full p-6 space-y-4 shadow-xl text-card-foreground font-mono"
          >
            <CornerPlus />
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-base font-bold tracking-tight text-foreground">Adicionar Registro ao Grafo</h3>
              <button
                type="button"
                onClick={() => setIsCreatingNode(false)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Tipo de Memória:
              </label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as NodeType)}
                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="conceito">Conceito</option>
                <option value="topico">Tópico</option>
                <option value="dificuldade">Dificuldade</option>
                <option value="equivoco">Equívoco</option>
                <option value="objetivo_aprendizagem">Objetivo de Aprendizagem</option>
                <option value="anotacao">Anotação</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Título do Registro:
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Tabela Hash com Encadeamento Aberto"
                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground font-semibold block mb-1">
                Descrição Detalhada:
              </label>
              <textarea
                rows={3}
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Explique o conceito ou anote a dúvida específica..."
                className="w-full bg-background border border-border rounded-lg p-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring shadow-2xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Domínio Inicial ({newDominio}%):
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={newDominio}
                  onChange={(e) => setNewDominio(Number(e.target.value))}
                  className="w-full accent-foreground"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground font-semibold block mb-1">
                  Dificuldade ({newDifficulty}/5):
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={newDifficulty}
                  onChange={(e) => setNewDifficulty(Number(e.target.value))}
                  className="w-full accent-foreground"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreatingNode(false)}
                className="font-mono text-xs cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="font-mono text-xs cursor-pointer shadow-2xs"
              >
                Salvar no Grafo
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
