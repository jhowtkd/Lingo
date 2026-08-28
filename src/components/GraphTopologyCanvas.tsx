import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GraphNode,
  GraphRelation,
  NodeType,
  RelationType,
} from '../types';
import { BorderTrail } from './ui/border-trail';
import { CornerPlus } from './ui/corner-plus';
import { Button } from './ui/button';
import {
  Sparkles,
  Zap,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Eye,
  Info,
  Clock,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface NodePosition {
  x: number;
  y: number;
}

interface GraphTopologyCanvasProps {
  nodes: GraphNode[];
  relations: GraphRelation[];
  sessionNewNodeIds: Set<string>;
  sessionNewRelationIds: Set<string>;
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  onUpdateMastery?: (node: GraphNode, delta: number) => void;
  getTypeBadge: (type: NodeType) => { label: string; bg: string };
  onSimulateNewNode?: () => void;
}

export const GraphTopologyCanvas: React.FC<GraphTopologyCanvasProps> = ({
  nodes,
  relations,
  sessionNewNodeIds,
  sessionNewRelationIds,
  selectedNode,
  onSelectNode,
  onUpdateMastery,
  getTypeBadge,
  onSimulateNewNode,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('todos');

  // Dimensões do Canvas Virtual
  const CANVAS_WIDTH = 1100;
  const CANVAS_HEIGHT = 700;

  // Inicializa posições calculadas matematicamente para organizar em topologia circular/orgânica
  useEffect(() => {
    if (nodes.length === 0) return;

    const positions: Record<string, NodePosition> = {};
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    // Encontra hubs principais (tipo 'topico' ou nós com maior número de relações)
    const topicNodes = nodes.filter((n) => n.tipo === 'topico');
    const otherNodes = nodes.filter((n) => n.tipo !== 'topico');

    if (topicNodes.length > 0) {
      // Posiciona tópicos no centro / anel interno
      topicNodes.forEach((t, i) => {
        const angle = (i / topicNodes.length) * 2 * Math.PI - Math.PI / 2;
        const radius = topicNodes.length === 1 ? 0 : 90;
        positions[t.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });

      // Posiciona outros nós em anéis concêntricos agrupados por tipo
      const groupedByType: Record<string, GraphNode[]> = {};
      otherNodes.forEach((n) => {
        if (!groupedByType[n.tipo]) groupedByType[n.tipo] = [];
        groupedByType[n.tipo].push(n);
      });

      let currentAngle = 0;
      const totalOthers = otherNodes.length;
      otherNodes.forEach((n, idx) => {
        const angle = (idx / totalOthers) * 2 * Math.PI;
        // Distância baseada no tipo para criar agrupamentos semânticos
        let radius = 260;
        if (n.tipo === 'dificuldade' || n.tipo === 'equivoco' || n.tipo === 'falso_amigo') {
          radius = 330;
        } else if (n.tipo === 'vocabulario' || n.tipo === 'conceito') {
          radius = 230;
        } else if (n.tipo === 'gramatica') {
          radius = 290;
        }

        // Adiciona variação senoidal suave para evitar sobreposição
        const wobble = ((idx % 3) - 1) * 35;

        positions[n.id] = {
          x: Math.max(90, Math.min(CANVAS_WIDTH - 90, centerX + Math.cos(angle) * (radius + wobble))),
          y: Math.max(70, Math.min(CANVAS_HEIGHT - 70, centerY + Math.sin(angle) * (radius + wobble))),
        };
      });
    } else {
      // Distribuição circular padrão
      nodes.forEach((n, idx) => {
        const angle = (idx / nodes.length) * 2 * Math.PI;
        const radius = 250;
        positions[n.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });
    }

    setNodePositions(positions);
  }, [nodes]);

  // Manipulação de Arraste do Canvas (Pan)
  const handleMouseDownCanvas = (e: React.MouseEvent) => {
    if (draggingNodeId) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggingNodeId && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y) / zoom;

      setNodePositions((prev) => ({
        ...prev,
        [draggingNodeId]: {
          x: Math.max(60, Math.min(CANVAS_WIDTH - 60, rawX - dragOffset.x)),
          y: Math.max(50, Math.min(CANVAS_HEIGHT - 50, rawY - dragOffset.y)),
        },
      }));
    } else if (isPanning) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const pos = nodePositions[nodeId];
    if (!pos || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const currentMouseX = (e.clientX - rect.left - pan.x) / zoom;
    const currentMouseY = (e.clientY - rect.top - pan.y) / zoom;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: currentMouseX - pos.x,
      y: currentMouseY - pos.y,
    });
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Filtra nós visíveis
  const visibleNodes = useMemo(() => {
    if (filterType === 'todos') return nodes;
    if (filterType === 'novos_sessao') {
      return nodes.filter((n) => sessionNewNodeIds.has(n.id));
    }
    return nodes.filter((n) => n.tipo === filterType);
  }, [nodes, filterType, sessionNewNodeIds]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((n) => n.id)), [visibleNodes]);

  // Relações ativas conectadas entre nós visíveis
  const activeRelations = useMemo(() => {
    return relations.filter(
      (r) => visibleNodeIds.has(r.origem_id) && visibleNodeIds.has(r.destino_id)
    );
  }, [relations, visibleNodeIds]);

  const sessionNewCount = sessionNewNodeIds.size;
  const sessionRelCount = sessionNewRelationIds.size;

  return (
    <div className="space-y-4">
      {/* Barra Superior da Topologia */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border rounded-lg p-3 shadow-2xs font-mono">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 rounded bg-muted text-foreground border border-border">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-foreground tracking-tight">
                TOPOLOGIA INTERATIVA DA MEMÓRIA
              </span>
              {sessionNewCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-foreground text-background animate-pulse">
                  <Sparkles className="w-3 h-3" />
                  {sessionNewCount} NOVO{sessionNewCount > 1 ? 'S' : ''} NA SESSÃO
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Nós e conexões descobertos nesta sessão são destacados com o efeito dinâmico BorderTrail.
            </p>
          </div>
        </div>

        {/* Controles de Zoom, Filtro e Ações */}
        <div className="flex items-center space-x-2">
          {onSimulateNewNode && (
            <Button
              variant="outline"
              size="sm"
              onClick={onSimulateNewNode}
              className="gap-1.5 text-xs font-mono cursor-pointer"
              title="Registrar um novo conceito no grafo para visualizar o efeito BorderTrail em tempo real"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Simular Descoberta</span>
            </Button>
          )}

          {/* Filtros de Tipo */}
          <div className="flex items-center bg-muted/60 border border-border rounded-md p-0.5 text-xs">
            <button
              onClick={() => setFilterType('todos')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                filterType === 'todos'
                  ? 'bg-background text-foreground shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Todos ({nodes.length})
            </button>
            <button
              onClick={() => setFilterType('novos_sessao')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer flex items-center space-x-1 ${
                filterType === 'novos_sessao'
                  ? 'bg-foreground text-background shadow-2xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Novos ({sessionNewCount})</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-muted border border-border rounded-md">
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-l transition cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-bold px-1.5 text-muted-foreground">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 transition cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10 rounded-r transition cursor-pointer"
              title="Centralizar Visualização"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Área Principal de Renderização do Grafo */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Canvas de Grafo Interativo */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative lg:col-span-8 h-[600px] bg-card/60 backdrop-blur-xs border border-border rounded-lg overflow-hidden shadow-2xs select-none cursor-grab active:cursor-grabbing ${
            isPanning ? 'cursor-grabbing' : ''
          }`}
        >
          <CornerPlus />

          {/* Grade de fundo técnica estilo Blueprint */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20 dark:opacity-15"
            style={{
              backgroundImage:
                'radial-gradient(circle, currentColor 1px, transparent 1px), linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
              backgroundSize: '32px 32px, 160px 160px, 160px 160px',
            }}
          />

          {/* Legenda Flutuante */}
          <div className="absolute top-3 left-3 z-20 flex flex-wrap gap-2 pointer-events-auto bg-card/90 backdrop-blur-md border border-border rounded-md px-2.5 py-1.5 text-[10px] font-mono shadow-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Domínio ≥80%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-foreground" /> 55-79%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> &lt;55% (Dificuldade)
            </span>
            <span className="flex items-center gap-1 text-foreground font-bold">
              <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-400 to-rose-400 animate-ping" />
              BorderTrail: Criado nesta sessão
            </span>
          </div>

          {/* Container de Transformação Zoom/Pan */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              width: `${CANVAS_WIDTH}px`,
              height: `${CANVAS_HEIGHT}px`,
              position: 'absolute',
              top: 0,
              left: 0,
            }}
          >
            {/* SVG de Linhas e Arestas de Relação */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="currentColor" className="text-muted-foreground/60" />
                </marker>
                <marker
                  id="arrow-session-new"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="8"
                  markerHeight="8"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" className="text-foreground" />
                </marker>
              </defs>

              {activeRelations.map((rel) => {
                const sourcePos = nodePositions[rel.origem_id];
                const targetPos = nodePositions[rel.destino_id];
                if (!sourcePos || !targetPos) return null;

                const isSessionNewRel = sessionNewRelationIds.has(rel.id);
                const isConnectedToSelected =
                  selectedNode &&
                  (selectedNode.id === rel.origem_id || selectedNode.id === rel.destino_id);

                // Cálculo de curva suave Bezier
                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;
                const dx = targetPos.x - sourcePos.x;
                const dy = targetPos.y - sourcePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const curveOffset = Math.min(40, dist * 0.15);

                const controlX = midX - (dy / (dist || 1)) * curveOffset;
                const controlY = midY + (dx / (dist || 1)) * curveOffset;

                const pathData = `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;

                return (
                  <g key={rel.id} className="transition-opacity duration-200">
                    {/* Linha de brilho base se for novo na sessão */}
                    {isSessionNewRel && (
                      <path
                        d={pathData}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={4}
                        className="text-foreground/30 blur-[2px]"
                      />
                    )}

                    {/* Linha principal */}
                    <path
                      d={pathData}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={isSessionNewRel ? 2.5 : isConnectedToSelected ? 2 : 1.2}
                      strokeDasharray={isSessionNewRel ? '5 3' : 'none'}
                      markerEnd={isSessionNewRel ? 'url(#arrow-session-new)' : 'url(#arrow-default)'}
                      className={`${
                        isSessionNewRel
                          ? 'text-foreground animate-pulse'
                          : isConnectedToSelected
                          ? 'text-foreground/80'
                          : 'text-border'
                      }`}
                    />

                    {/* Tag de tipo de relação no centro */}
                    <foreignObject
                      x={controlX - 60}
                      y={controlY - 12}
                      width={120}
                      height={24}
                      className="overflow-visible pointer-events-none"
                    >
                      <div className="flex items-center justify-center">
                        <div
                          className={`relative px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase tracking-tighter border shadow-2xs whitespace-nowrap overflow-hidden ${
                            isSessionNewRel
                              ? 'bg-card border-foreground text-foreground font-bold'
                              : 'bg-card/90 border-border text-muted-foreground'
                          }`}
                        >
                          {isSessionNewRel && (
                            <BorderTrail
                              size={30}
                              transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}
                              style={{
                                boxShadow:
                                  '0px 0px 20px 10px rgb(255 255 255 / 40%), 0 0 40px 20px rgb(0 0 0 / 30%)',
                              }}
                            />
                          )}
                          <span>{rel.tipo.replace(/_/g, ' ')}</span>
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Renderização dos Nós do Grafo */}
            {visibleNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isNew = sessionNewNodeIds.has(node.id);
              const isSelected = selectedNode?.id === node.id;
              const isHovered = hoveredNodeId === node.id;
              const badge = getTypeBadge(node.tipo);
              const isPendingReview = new Date(node.proxima_revisao) <= new Date();

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectNode(node);
                  }}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  style={{
                    left: `${pos.x}px`,
                    top: `${pos.y}px`,
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`absolute z-10 w-52 rounded-lg border bg-card p-3 shadow-sm transition-shadow duration-150 cursor-pointer select-none font-mono ${
                    isSelected
                      ? 'border-foreground ring-2 ring-foreground/30 shadow-md'
                      : isNew
                      ? 'border-foreground/80 shadow-md ring-1 ring-foreground/20'
                      : 'border-border hover:border-foreground/50'
                  } ${isNew ? 'overflow-hidden' : ''}`}
                >
                  <CornerPlus size="size-2.5" />

                  {/* BORDERTRAIL EFFECT PARA NÓS NOVOS NESTA SESSÃO */}
                  {isNew && (
                    <BorderTrail
                      size={75}
                      transition={{ repeat: Infinity, duration: 5, ease: 'linear' }}
                      style={{
                        boxShadow:
                          '0px 0px 50px 25px rgb(255 255 255 / 40%), 0 0 80px 45px rgb(0 0 0 / 30%)',
                      }}
                    />
                  )}

                  {/* Cabeçalho do Nó */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.bg}`}>
                      {badge.label}
                    </span>

                    {isNew ? (
                      <span className="flex items-center space-x-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded bg-foreground text-background shadow-2xs">
                        <Sparkles className="w-2.5 h-2.5" />
                        <span>SESSÃO</span>
                      </span>
                    ) : isPendingReview ? (
                      <span className="flex items-center space-x-0.5 text-[9px] font-bold px-1 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        <Clock className="w-2.5 h-2.5" />
                        <span>REV</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Título e Breve Descrição */}
                  <h4 className="text-xs font-bold text-foreground line-clamp-1 tracking-tight">
                    {node.titulo}
                  </h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2 leading-tight">
                    {node.descricao}
                  </p>

                  {/* Barra de Domínio */}
                  <div className="mt-2 pt-1.5 border-t border-border flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">Domínio:</span>
                    <span className="font-bold text-foreground">{node.dominio_estimado}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1 overflow-hidden mt-1">
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
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel Lateral: Inspetor de Detalhes e Relações do Nó Selecionado */}
        <div className="lg:col-span-4 space-y-3 font-mono">
          {selectedNode ? (
            <div className="relative bg-card border border-border rounded-lg p-5 shadow-2xs space-y-4">
              <CornerPlus />

              {/* Se o nó selecionado for novo, aplica o BorderTrail no inspetor também */}
              {sessionNewNodeIds.has(selectedNode.id) && (
                <BorderTrail
                  size={90}
                  transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                  style={{
                    boxShadow:
                      '0px 0px 50px 25px rgb(255 255 255 / 35%), 0 0 80px 45px rgb(0 0 0 / 25%)',
                  }}
                />
              )}

              <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        getTypeBadge(selectedNode.tipo).bg
                      }`}
                    >
                      {getTypeBadge(selectedNode.tipo).label}
                    </span>
                    {sessionNewNodeIds.has(selectedNode.id) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-foreground text-background flex items-center space-x-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Adicionado na Sessão</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight">
                    {selectedNode.titulo}
                  </h3>
                </div>
                <button
                  onClick={() => onSelectNode(null)}
                  className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Descrição */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Definição Pedagógica:
                </span>
                <p className="text-xs text-foreground mt-1 bg-muted/30 p-2.5 rounded border border-border leading-relaxed">
                  {selectedNode.descricao}
                </p>
              </div>

              {/* Ajuste Rápido de Domínio */}
              {onUpdateMastery && (
                <div className="bg-muted/20 p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-semibold">Nível de Domínio:</span>
                    <span className="font-bold text-foreground">{selectedNode.dominio_estimado}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateMastery(selectedNode, -10)}
                      className="text-xs h-7 px-2 cursor-pointer"
                    >
                      -10%
                    </Button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedNode.dominio_estimado}
                      onChange={(e) =>
                        onUpdateMastery(selectedNode, Number(e.target.value) - selectedNode.dominio_estimado)
                      }
                      className="flex-1 accent-foreground h-1.5"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onUpdateMastery(selectedNode, 10)}
                      className="text-xs h-7 px-2 cursor-pointer"
                    >
                      +10%
                    </Button>
                  </div>
                </div>
              )}

              {/* Conexões Diretas no Grafo */}
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold">
                  Conexões no Grafo ({relations.filter(r => r.origem_id === selectedNode.id || r.destino_id === selectedNode.id).length}):
                </span>
                <div className="mt-1.5 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {relations
                    .filter((r) => r.origem_id === selectedNode.id || r.destino_id === selectedNode.id)
                    .map((r) => {
                      const isOrigin = r.origem_id === selectedNode.id;
                      const otherId = isOrigin ? r.destino_id : r.origem_id;
                      const otherNode = nodes.find((n) => n.id === otherId);
                      const isSessionNewRel = sessionNewRelationIds.has(r.id);

                      return (
                        <div
                          key={r.id}
                          onClick={() => otherNode && onSelectNode(otherNode)}
                          className={`flex items-center justify-between p-2 rounded border text-xs cursor-pointer transition ${
                            isSessionNewRel
                              ? 'bg-muted/60 border-foreground text-foreground'
                              : 'bg-muted/20 border-border text-foreground hover:bg-muted/40'
                          }`}
                        >
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold text-[10px] text-foreground">
                              {isOrigin ? `[${r.tipo}]` : `[← ${r.tipo}]`}
                            </span>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium line-clamp-1">
                              {otherNode?.titulo || 'Outro Nó'}
                            </span>
                          </div>
                          {isSessionNewRel && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-foreground text-background font-bold">
                              NOVO
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative bg-card border border-border rounded-lg p-6 text-center space-y-3 shadow-2xs text-muted-foreground">
              <CornerPlus />
              <Layers className="w-8 h-8 mx-auto text-muted-foreground opacity-60" />
              <h4 className="text-xs font-bold text-foreground">Selecione um Nó para Inspecionar</h4>
              <p className="text-[11px] leading-relaxed">
                Clique em qualquer nó ou linha de conexão para visualizar o histórico de retenção, ajustar o domínio ou navegar pelas relações.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
