import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { useGetWorkflowDefinition } from "../api/useGetWorkflowDefinition";

import { layoutDag, type LayoutNode } from "./lib/dagLayout";
import {
  buildEdgePath,
  edgeLabelPoint,
  nodeAnchor,
  NODE_HEIGHT,
  NODE_WIDTH,
} from "./lib/edgePath";
import { safeParseGraph, type GraphNodeType, type ParsedEdge } from "./lib/parseGraph";

interface WorkflowGraphMiniProps {
  workspaceId: number | null;
  packId: number;
  versionId: number;
  workflowId: number;
}

const MAX_LABEL_NODES = 100;

function truncate(label: string, max = 10): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

function NodeShape({
  node,
  showLabel,
}: {
  node: LayoutNode;
  showLabel: boolean;
}) {
  const stroke = "var(--ink)";
  const paper = "var(--paper)";
  const ink = "var(--ink)";
  const w = NODE_WIDTH;
  const h = NODE_HEIGHT;
  const sw = 1.2;
  const labelColor = node.type === "START" || node.type === "TERMINAL" ? paper : ink;
  const labelText = showLabel ? truncate(node.label) : "";
  return (
    <g data-node-id={node.id} data-node-type={node.type}>
      {renderShape(node.type, node.x, node.y, w, h, ink, paper, stroke, sw)}
      {showLabel && (
        <text
          x={node.x}
          y={node.y + 3}
          textAnchor="middle"
          fontSize={9}
          fontFamily="var(--mono)"
          fill={labelColor}
          style={{ pointerEvents: "none" }}
        >
          {labelText}
        </text>
      )}
    </g>
  );
}

function renderShape(
  type: GraphNodeType,
  x: number,
  y: number,
  w: number,
  h: number,
  ink: string,
  paper: string,
  stroke: string,
  sw: number,
) {
  switch (type) {
    case "START":
      return (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={h / 2}
          ry={h / 2}
          fill={ink}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "ACTION":
      return (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={4}
          ry={4}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case "DECISION": {
      const rx = w * 0.55;
      const ry = h * 0.85;
      return (
        <polygon
          points={`${x},${y - ry} ${x + rx},${y} ${x},${y + ry} ${x - rx},${y}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "ANSWER": {
      const cut = 6;
      return (
        <polygon
          points={`${x - w / 2 + cut},${y - h / 2} ${x + w / 2},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "HANDOFF": {
      const cut = 6;
      return (
        <polygon
          points={`${x - w / 2 + cut},${y - h / 2} ${x + w / 2 - cut},${y - h / 2} ${x + w / 2},${y + h / 2} ${x - w / 2},${y + h / 2}`}
          fill={paper}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    }
    case "TERMINAL":
      return (
        <rect
          x={x - w / 2}
          y={y - h / 2}
          width={w}
          height={h}
          rx={h / 2}
          ry={h / 2}
          fill={ink}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    default:
      return <circle cx={x} cy={y} r={h / 2} fill={paper} stroke={stroke} strokeWidth={sw} />;
  }
}

function EdgeLine({
  edge,
  from,
  to,
  sameLayer,
  markerId,
}: {
  edge: ParsedEdge;
  from: LayoutNode;
  to: LayoutNode;
  sameLayer: boolean;
  markerId: string;
}) {
  const start = nodeAnchor(from.type, from, to);
  const end = nodeAnchor(to.type, to, from);
  const path = buildEdgePath(start, end, sameLayer);
  const labelPoint = edgeLabelPoint(start, end);
  return (
    <g data-edge-id={edge.id}>
      <path
        d={path}
        fill="none"
        stroke="var(--ink-3)"
        strokeWidth={1.2}
        markerEnd={`url(#${markerId})`}
      />
      {edge.label && (
        <g>
          <rect
            x={labelPoint.x - edge.label.length * 3 - 4}
            y={labelPoint.y - 8}
            width={edge.label.length * 6 + 8}
            height={12}
            rx={2}
            fill="var(--paper)"
            stroke="var(--line)"
            strokeWidth={0.6}
          />
          <text
            x={labelPoint.x}
            y={labelPoint.y + 1}
            textAnchor="middle"
            fontSize={9}
            fontFamily="var(--mono)"
            fill="var(--ink-2)"
            style={{ pointerEvents: "none" }}
          >
            {truncate(edge.label, 14)}
          </text>
        </g>
      )}
    </g>
  );
}

export function WorkflowGraphMini({
  workspaceId,
  packId,
  versionId,
  workflowId,
}: WorkflowGraphMiniProps) {
  const params = useParams();
  const wsIdRaw = workspaceId ?? (params.workspaceId ? Number(params.workspaceId) : NaN);
  const wsId = Number.isFinite(wsIdRaw) ? wsIdRaw : 0;
  const enabled = wsId > 0 && packId > 0 && versionId > 0 && workflowId > 0;

  const query = useGetWorkflowDefinition({
    workspaceId: wsId,
    packId,
    versionId,
    workflowId,
    enabled,
  });

  const graph = useMemo(() => {
    if (!query.data) return null;
    const parsed = safeParseGraph((query.data as { graphJson?: unknown }).graphJson);
    const layout = layoutDag(parsed.nodes, parsed.edges);
    return { layout, edges: parsed.edges };
  }, [query.data]);

  if (!enabled || query.isLoading) {
    return (
      <span
        data-testid={`workflow-graph-mini-loading-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-3)" }}
      >
        loading…
      </span>
    );
  }

  if (query.isError || !query.data || !graph) {
    return (
      <span
        data-testid={`workflow-graph-mini-error-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--danger)" }}
      >
        graph unavailable
      </span>
    );
  }

  const nodes = graph.layout.nodes;
  if (nodes.length === 0) {
    return (
      <span
        data-testid={`workflow-graph-mini-empty-${workflowId}`}
        style={{ fontFamily: "var(--mono)", fontSize: "10px", color: "var(--ink-3)" }}
      >
        empty graph
      </span>
    );
  }

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const padX = NODE_WIDTH;
  const padY = NODE_HEIGHT + 12;
  const width = Math.max(NODE_WIDTH, maxX - minX) + padX * 2;
  const height = Math.max(NODE_HEIGHT, maxY - minY) + padY * 2;
  const showLabels = nodes.length <= MAX_LABEL_NODES;
  const markerId = `wfm-arrow-${workflowId}`;
  const nodeById = new Map(nodes.map((n) => [n.id, n] as const));

  return (
    <svg
      data-testid={`workflow-graph-mini-${workflowId}`}
      data-has-cycle={graph.layout.hasCycle ? "true" : "false"}
      viewBox={`${minX - padX} ${minY - padY} ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      height="100%"
      style={{ display: "block" }}
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-3)" />
        </marker>
      </defs>
      {graph.edges.map((edge) => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        if (!from || !to) return null;
        const sameLayer = from.x === to.x;
        return (
          <EdgeLine
            key={edge.id}
            edge={edge}
            from={from}
            to={to}
            sameLayer={sameLayer}
            markerId={markerId}
          />
        );
      })}
      {nodes.map((n) => (
        <NodeShape key={n.id} node={n} showLabel={showLabels} />
      ))}
    </svg>
  );
}
