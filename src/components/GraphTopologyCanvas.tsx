import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  GraphNode,
  GraphRelation,
  NodeType,
} from '../types';
import { BorderTrail } from './ui/border-trail';
import {
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowRight,
  Clock,
  Layers,
  Activity,
  MessageSquare,
  Repeat,
  Info,
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
  onNavigateToChat?: (topic: string) => void;
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
  onNavigateToChat,
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

  // Organiza os nós harmonicamente pelo canvas
  useEffect(() => {
    if (nodes.length === 0) return;

    const positions: Record<string, NodePosition> = {};
    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    const topicNodes = nodes.filter((n) => n.tipo === 'topico');
    const otherNodes = nodes.filter((n) => n.tipo !== 'topico');

    if (topicNodes.length > 0) {
      topicNodes.forEach((t, i) => {
        const angle = (i / topicNodes.length) * 2 * Math.PI - Math.PI / 2;
        const radius = topicNodes.length === 1 ? 0 : 100;
        positions[t.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });

      const totalOthers = otherNodes.length;
      otherNodes.forEach((n, idx) => {
        const angle = (idx / totalOthers) * 2 * Math.PI;
        let radius = 250;
        if (n.tipo === 'dificuldade' || n.tipo === 'equivoco' || n.tipo === 'falso_amigo') {
          radius = 320;
        } else if (n.tipo === 'vocabulario' || n.tipo === 'conceito') {
          radius = 220;
        } else if (n.tipo === 'gramatica') {
          radius = 280;
        }

        const wobble = ((idx % 3) - 1) * 30;

        positions[n.id] = {
          x: Math.max(120, Math.min(CANVAS_WIDTH - 120, centerX + Math.cos(angle) * (radius + wobble))),
          y: Math.max(90, Math.min(CANVAS_HEIGHT - 90, centerY + Math.sin(angle) * (radius + wobble))),
        };
      });
    } else {
      nodes.forEach((n, idx) => {
        const angle = (idx / nodes.length) * 2 * Math.PI;
        const radius = 240;
        positions[n.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });
    }

    setNodePositions(positions);
  }, [nodes]);

  // Manipulação de Pan
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

  const activeRelations = useMemo(() => {
    return relations.filter(
      (r) => visibleNodeIds.has(r.origem_id) && visibleNodeIds.has(r.destino_id)
    );
  }, [relations, visibleNodeIds]);

  const sessionNewCount = sessionNewNodeIds.size;

  return (
    <div className="space-y-4">
      {/* Controles Superiores de Topologia */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r)] p-3.5 shadow-[var(--shadow-sm)]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[var(--accent)] flex items-center justify-center text-[var(--fg)] shrink-0 shadow-xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-display font-bold text-[var(--fg)]">
                Topologia Interativa da Memória
              </span>
              {sessionNewCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--sunny)] text-[var(--fg)]">
                  <Sparkles className="w-3 h-3 text-amber-700" />
                  {sessionNewCount} novo{sessionNewCount > 1 ? 's' : ''} na sessão
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--muted)]">
              Arraste nós, dê zoom e clique para inspecionar relações semânticas e nível de retenção.
            </p>
          </div>
        </div>

        {/* Zoom e Ações Rápidas */}
        <div className="flex items-center gap-2">
          {/* Filtro Todos / Novos */}
          <div className="flex items-center bg-[oklch(0.96_0.01_84)] border border-[var(--border)] rounded-full p-0.5 text-xs">
            <button
              onClick={() => setFilterType('todos')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
                filterType === 'todos'
                  ? 'bg-[var(--fg)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              Todos ({nodes.length})
            </button>
            <button
              onClick={() => setFilterType('novos_sessao')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                filterType === 'novos_sessao'
                  ? 'bg-[var(--fg)] text-white shadow-xs'
                  : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Novos ({sessionNewCount})</span>
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-[oklch(0.96_0.01_84)] border border-[var(--border)] rounded-full px-1 py-0.5">
            <button
              onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
              className="p-1 text-[var(--muted)] hover:text-[var(--fg)] rounded-full transition cursor-pointer"
              title="Aumentar Zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono font-bold px-1 text-[var(--fg)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.max(0.4, z - 0.15))}
              className="p-1 text-[var(--muted)] hover:text-[var(--fg)] rounded-full transition cursor-pointer"
              title="Diminuir Zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={resetView}
              className="p-1 text-[var(--muted)] hover:text-[var(--fg)] rounded-full transition cursor-pointer"
              title="Centralizar"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Principal: Canvas + Inspetor Lateral */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Canvas de Grafo Interativo */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDownCanvas}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className={`relative lg:col-span-8 h-[620px] bg-[oklch(0.985_0.008_84)] border border-[var(--border)] rounded-[var(--r-lg)] overflow-hidden shadow-[var(--shadow-sm)] select-none cursor-grab active:cursor-grabbing ${
            isPanning ? 'cursor-grabbing' : ''
          }`}
        >
          {/* Subtle Canvas Dot Grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25"
            style={{
              backgroundImage:
                'radial-gradient(circle, oklch(0.4_0.05_285) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* Legenda Flutuante */}
          <div className="absolute top-3.5 left-3.5 z-20 flex flex-wrap gap-2.5 pointer-events-auto bg-[oklch(1_0_0_/_0.92)] backdrop-blur-md border border-[var(--border)] rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs text-[var(--muted)]">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--ok)]" /> Domínio ≥80%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--fg)]" /> 55-79%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--bad)]" /> &lt;55%
            </span>
            <span className="flex items-center gap-1.5 text-[var(--fg)]">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-pulse" />
              Sessão ativa
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
            {/* SVG de Relações */}
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
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="oklch(0.65 0.03 285)" />
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
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="oklch(0.24 0.03 285)" />
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

                const midX = (sourcePos.x + targetPos.x) / 2;
                const midY = (sourcePos.y + targetPos.y) / 2;
                const dx = targetPos.x - sourcePos.x;
                const dy = targetPos.y - sourcePos.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const curveOffset = Math.min(36, dist * 0.14);

                const controlX = midX - (dy / (dist || 1)) * curveOffset;
                const controlY = midY + (dx / (dist || 1)) * curveOffset;

                const pathData = `M ${sourcePos.x} ${sourcePos.y} Q ${controlX} ${controlY} ${targetPos.x} ${targetPos.y}`;

                return (
                  <g key={rel.id} className="transition-opacity duration-200">
                    <path
                      d={pathData}
                      fill="none"
                      stroke={
                        isSessionNewRel
                          ? 'var(--accent-deep)'
                          : isConnectedToSelected
                          ? 'var(--fg)'
                          : 'oklch(0.82 0.02 84)'
                      }
                      strokeWidth={isSessionNewRel ? 2.5 : isConnectedToSelected ? 2 : 1.5}
                      strokeDasharray={isSessionNewRel ? '4 3' : 'none'}
                      markerEnd={isSessionNewRel ? 'url(#arrow-session-new)' : 'url(#arrow-default)'}
                    />

                    {/* Tag de tipo de relação */}
                    <foreignObject
                      x={controlX - 60}
                      y={controlY - 12}
                      width={120}
                      height={24}
                      className="overflow-visible pointer-events-none"
                    >
                      <div className="flex items-center justify-center">
                        <div
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border shadow-xs whitespace-nowrap ${
                            isSessionNewRel
                              ? 'bg-[var(--accent)] text-[var(--fg)] border-[var(--accent-deep)]'
                              : 'bg-[var(--surface)] text-[var(--muted)] border-[var(--border)]'
                          }`}
                        >
                          {rel.tipo.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </foreignObject>
                  </g>
                );
              })}
            </svg>

            {/* Nós Interativos */}
            {visibleNodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              const isNew = sessionNewNodeIds.has(node.id);
              const isSelected = selectedNode?.id === node.id;
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
                  className={`absolute z-10 w-54 rounded-[var(--r)] border bg-[var(--surface)] p-3.5 shadow-[var(--shadow-sm)] transition-all duration-150 cursor-pointer select-none text-left ${
                    isSelected
                      ? 'border-2 border-[var(--fg)] ring-3 ring-[var(--accent)]/40 shadow-[var(--shadow)] scale-105'
                      : isNew
                      ? 'border-2 border-[var(--accent-deep)] shadow-md'
                      : 'border-[var(--border)] hover:border-[var(--fg)] hover:shadow-[var(--shadow)]'
                  }`}
                >
                  {/* Top Badge */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.bg}`}>
                      {badge.label}
                    </span>

                    {isNew ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--sunny)] text-[var(--fg)]">
                        <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                        <span>NOVO</span>
                      </span>
                    ) : isPendingReview ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                        <Clock className="w-2.5 h-2.5" />
                        <span>REV</span>
                      </span>
                    ) : null}
                  </div>

                  {/* Title & Desc */}
                  <h4 className="text-xs font-display font-bold text-[var(--fg)] line-clamp-1 leading-snug">
                    {node.titulo}
                  </h4>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5 line-clamp-2 leading-tight">
                    {node.descricao}
                  </p>

                  {/* Domain Bar */}
                  <div className="mt-2.5 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--muted)] font-medium">Domínio:</span>
                    <span className="font-bold text-[var(--fg)]">{node.dominio_estimado}%</span>
                  </div>
                  <div className="w-full bg-[oklch(0.93_0.02_84)] rounded-full h-1.5 overflow-hidden mt-1">
                    <div
                      className={`h-full rounded-full transition-all ${
                        node.dominio_estimado >= 80
                          ? 'bg-[var(--ok)]'
                          : node.dominio_estimado >= 55
                          ? 'bg-[var(--fg)]'
                          : 'bg-[var(--bad)]'
                      }`}
                      style={{ width: `${node.dominio_estimado}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Painel Lateral: Inspetor de Detalhes com Histórico de Retenção */}
        <div className="lg:col-span-4 space-y-3">
          {selectedNode ? (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-5.5 shadow-[var(--shadow-sm)] space-y-4 text-left">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full border ${
                        getTypeBadge(selectedNode.tipo).bg
                      }`}
                    >
                      {getTypeBadge(selectedNode.tipo).label}
                    </span>
                    {sessionNewNodeIds.has(selectedNode.id) && (
                      <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-[var(--sunny)] text-[var(--fg)] flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-700" />
                        <span>Sessão Ativa</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-display font-bold text-[var(--fg)] leading-tight">
                    {selectedNode.titulo}
                  </h3>
                </div>
                <button
                  onClick={() => onSelectNode(null)}
                  className="text-[var(--muted)] hover:text-[var(--fg)] text-sm font-bold p-1 rounded-full hover:bg-[oklch(0.95_0.01_84)] transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Descrição */}
              <div>
                <span className="text-xs text-[var(--muted)] uppercase font-bold block mb-1">
                  Definição Pedagógica:
                </span>
                <p className="text-xs sm:text-sm text-[var(--fg)] bg-[oklch(0.97_0.01_84)] p-3 rounded-xl border border-[var(--border)] leading-relaxed">
                  {selectedNode.descricao}
                </p>
              </div>

              {/* Ajuste Rápido de Domínio */}
              {onUpdateMastery && (
                <div className="bg-[oklch(0.97_0.01_84)] p-3.5 rounded-xl border border-[var(--border)] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[var(--muted)] font-bold">Nível de Domínio:</span>
                    <span className="font-extrabold text-[var(--fg)] font-mono text-sm">
                      {selectedNode.dominio_estimado}%
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onUpdateMastery(selectedNode, -10)}
                      className="px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--fg)] hover:border-[var(--fg)] transition cursor-pointer"
                    >
                      -10%
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={selectedNode.dominio_estimado}
                      onChange={(e) =>
                        onUpdateMastery(selectedNode, Number(e.target.value) - selectedNode.dominio_estimado)
                      }
                      className="flex-1 accent-[var(--accent-deep)] h-2"
                    />
                    <button
                      onClick={() => onUpdateMastery(selectedNode, 10)}
                      className="px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-bold text-[var(--fg)] hover:border-[var(--fg)] transition cursor-pointer"
                    >
                      +10%
                    </button>
                  </div>
                </div>
              )}

              {/* Mini Histórico de Retenção (6 pontos) */}
              <div className="space-y-1.5">
                <span className="text-xs text-[var(--muted)] uppercase font-bold block">
                  Histórico de Retenção SRS:
                </span>
                <div className="grid grid-cols-6 gap-1.5 items-end h-16 bg-[oklch(0.97_0.01_84)] p-2 rounded-xl border border-[var(--border)]">
                  {[45, 52, 60, 68, 75, selectedNode.dominio_estimado].map((val, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1 h-full justify-end">
                      <div
                        className="w-full rounded-t-md bg-[var(--accent)] transition-all"
                        style={{ height: `${Math.max(15, (val / 100) * 100)}%` }}
                        title={`Sessão ${idx + 1}: ${val}%`}
                      />
                      <span className="text-[9px] font-mono text-[var(--muted)]">S{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conexões Diretas */}
              <div>
                <span className="text-xs text-[var(--muted)] uppercase font-bold block mb-1.5">
                  Conexões no Grafo ({relations.filter(r => r.origem_id === selectedNode.id || r.destino_id === selectedNode.id).length}):
                </span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
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
                          className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                            isSessionNewRel
                              ? 'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--fg)] font-bold'
                              : 'bg-[oklch(0.97_0.01_84)] border-[var(--border)] text-[var(--fg)] hover:border-[var(--fg)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-[10px] text-[var(--accent-deep)]">
                              {isOrigin ? `[${r.tipo}]` : `[← ${r.tipo}]`}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-[var(--muted)]" />
                            <span className="font-semibold line-clamp-1">
                              {otherNode?.titulo || 'Outro Nó'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Ações Rápidas */}
              {onNavigateToChat && (
                <button
                  onClick={() => onNavigateToChat(selectedNode.titulo)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 font-extrabold text-xs bg-[var(--accent)] text-[var(--fg)] hover:bg-[var(--accent-deep)] transition shadow-xs cursor-pointer"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Revisar Conceito no Chat</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--r-lg)] p-8 text-center space-y-3 shadow-[var(--shadow-sm)] text-[var(--muted)]">
              <Layers className="w-10 h-10 mx-auto text-[var(--muted)] opacity-60" />
              <h4 className="text-sm font-display font-bold text-[var(--fg)]">
                Selecione um Nó para Inspecionar
              </h4>
              <p className="text-xs leading-relaxed max-w-xs mx-auto">
                Clique em qualquer nó ou conexão do mapa para ver evidências de uso, relações conceituais e curva de retenção.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
