export type RevisionChangedField = "name" | "description";
export type WorkflowRevisionChangedField =
  | "name"
  | "description"
  | "graphText"
  | "graphStructure";

export interface IntentRevisionSource {
  id?: number;
  intentCode?: string | null;
  name?: string | null;
  description?: string | null;
}

export interface WorkflowRevisionSource {
  id?: number;
  workflowCode?: string | null;
  name?: string | null;
  description?: string | null;
  graphJson?: string | null;
  initialState?: string | null;
  terminalStatesJson?: string | null;
}

export interface IntentRevisionChange {
  intentId: number;
  intentCode: string;
  name: string;
  fields: RevisionChangedField[];
  before: {
    name: string;
    description: string;
  };
  after: {
    name: string;
    description: string;
  };
}

export interface WorkflowRevisionChange {
  workflowId: number;
  workflowCode: string;
  name: string;
  fields: WorkflowRevisionChangedField[];
  before: {
    name: string;
    description: string;
    nodeCount: number | null;
    edgeCount: number | null;
  };
  after: {
    name: string;
    description: string;
    nodeCount: number | null;
    edgeCount: number | null;
  };
}

export interface IntentRevisionSummary {
  changedIntents: IntentRevisionChange[];
  changedWorkflows: WorkflowRevisionChange[];
  changedFieldCounts: Record<RevisionChangedField, number>;
  changedWorkflowFieldCounts: Record<WorkflowRevisionChangedField, number>;
  changedByDraftIntentId: Record<number, IntentRevisionChange>;
  changedByDraftWorkflowId: Record<number, WorkflowRevisionChange>;
  totalChangedComponents: number;
}

type JsonRecord = Record<string, unknown>;

interface GraphFingerprint {
  text: string;
  structure: string;
  nodeCount: number | null;
  edgeCount: number | null;
}

function normalizeText(value: string | null | undefined): string {
  return value ?? "";
}

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readNodeId(value: JsonRecord): string {
  return readString(value.id);
}

function readEdgeId(value: JsonRecord): string {
  return readString(value.id) || `${readString(value.from)}>${readString(value.to)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value)
    .sort((a, b) => a.localeCompare(b))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function parseGraph(raw: string): unknown {
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.trim();
  }
}

function fingerprintGraph(workflow: WorkflowRevisionSource): GraphFingerprint {
  const rawGraph = normalizeText(workflow.graphJson);
  const parsed = parseGraph(rawGraph);

  if (!isRecord(parsed)) {
    const fallback = stableStringify({
      graphJson: parsed,
      initialState: normalizeText(workflow.initialState),
      terminalStatesJson: normalizeText(workflow.terminalStatesJson),
    });
    return {
      text: fallback,
      structure: fallback,
      nodeCount: null,
      edgeCount: null,
    };
  }

  const nodes = Array.isArray(parsed.nodes) ? parsed.nodes.filter(isRecord) : [];
  const edges = Array.isArray(parsed.edges) ? parsed.edges.filter(isRecord) : [];

  const nodeText = nodes
    .map((node) => ({
      id: readNodeId(node),
      label: readString(node.label),
      description: readString(node.description),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edgeText = edges
    .map((edge) => ({
      id: readEdgeId(edge),
      label: readString(edge.label),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const nodeStructure = nodes
    .map((node) => ({
      id: readNodeId(node),
      type: readString(node.type),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const edgeStructure = edges
    .map((edge) => ({
      id: readEdgeId(edge),
      from: readString(edge.from),
      to: readString(edge.to),
      sourceHandle: readString(edge.sourceHandle),
      targetHandle: readString(edge.targetHandle),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    text: stableStringify({ nodes: nodeText, edges: edgeText }),
    structure: stableStringify({
      direction: readString(parsed.direction),
      initialState: normalizeText(workflow.initialState),
      terminalStatesJson: normalizeText(workflow.terminalStatesJson),
      nodes: nodeStructure,
      edges: edgeStructure,
    }),
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

function buildIntentChanges(
  baseIntents: IntentRevisionSource[],
  draftIntents: IntentRevisionSource[],
): IntentRevisionChange[] {
  const baseByCode = new Map(
    baseIntents
      .filter((intent) => intent.intentCode)
      .map((intent) => [intent.intentCode as string, intent]),
  );

  return draftIntents.flatMap<IntentRevisionChange>((draft) => {
    if (draft.id == null || !draft.intentCode) return [];

    const base = baseByCode.get(draft.intentCode);
    if (!base) return [];

    const fields: RevisionChangedField[] = [];
    const before = {
      name: normalizeText(base.name),
      description: normalizeText(base.description),
    };
    const after = {
      name: normalizeText(draft.name),
      description: normalizeText(draft.description),
    };

    if (before.name !== after.name) fields.push("name");
    if (before.description !== after.description) fields.push("description");
    if (fields.length === 0) return [];

    return [
      {
        intentId: draft.id,
        intentCode: draft.intentCode,
        name: after.name,
        fields,
        before,
        after,
      },
    ];
  });
}

function buildWorkflowChanges(
  baseWorkflows: WorkflowRevisionSource[],
  draftWorkflows: WorkflowRevisionSource[],
): WorkflowRevisionChange[] {
  const baseByCode = new Map(
    baseWorkflows
      .filter((workflow) => workflow.workflowCode)
      .map((workflow) => [workflow.workflowCode as string, workflow]),
  );

  return draftWorkflows.flatMap<WorkflowRevisionChange>((draft) => {
    if (draft.id == null || !draft.workflowCode) return [];

    const base = baseByCode.get(draft.workflowCode);
    if (!base) return [];

    const baseGraph = fingerprintGraph(base);
    const draftGraph = fingerprintGraph(draft);
    const fields: WorkflowRevisionChangedField[] = [];
    const before = {
      name: normalizeText(base.name),
      description: normalizeText(base.description),
      nodeCount: baseGraph.nodeCount,
      edgeCount: baseGraph.edgeCount,
    };
    const after = {
      name: normalizeText(draft.name),
      description: normalizeText(draft.description),
      nodeCount: draftGraph.nodeCount,
      edgeCount: draftGraph.edgeCount,
    };

    if (before.name !== after.name) fields.push("name");
    if (before.description !== after.description) fields.push("description");
    if (baseGraph.text !== draftGraph.text) fields.push("graphText");
    if (baseGraph.structure !== draftGraph.structure) fields.push("graphStructure");
    if (fields.length === 0) return [];

    return [
      {
        workflowId: draft.id,
        workflowCode: draft.workflowCode,
        name: after.name,
        fields,
        before,
        after,
      },
    ];
  });
}

export function buildDomainPackRevisionSummary({
  baseIntents,
  draftIntents,
  baseWorkflows = [],
  draftWorkflows = [],
}: {
  baseIntents: IntentRevisionSource[];
  draftIntents: IntentRevisionSource[];
  baseWorkflows?: WorkflowRevisionSource[];
  draftWorkflows?: WorkflowRevisionSource[];
}): IntentRevisionSummary {
  const changedIntents = buildIntentChanges(baseIntents, draftIntents);
  const changedWorkflows = buildWorkflowChanges(baseWorkflows, draftWorkflows);

  return {
    changedIntents,
    changedWorkflows,
    changedFieldCounts: {
      name: changedIntents.filter((change) => change.fields.includes("name")).length,
      description: changedIntents.filter((change) => change.fields.includes("description")).length,
    },
    changedWorkflowFieldCounts: {
      name: changedWorkflows.filter((change) => change.fields.includes("name")).length,
      description: changedWorkflows.filter((change) => change.fields.includes("description"))
        .length,
      graphText: changedWorkflows.filter((change) => change.fields.includes("graphText")).length,
      graphStructure: changedWorkflows.filter((change) =>
        change.fields.includes("graphStructure"),
      ).length,
    },
    changedByDraftIntentId: Object.fromEntries(
      changedIntents.map((change) => [change.intentId, change]),
    ),
    changedByDraftWorkflowId: Object.fromEntries(
      changedWorkflows.map((change) => [change.workflowId, change]),
    ),
    totalChangedComponents: changedIntents.length + changedWorkflows.length,
  };
}
