export interface IntentSummary {
  id: number;
  intentCode: string;
  name: string;
  description: string | null;
  taxonomyLevel: number;
  parentIntentId: number | null;
  status: string;
  sourceClusterRef: string;
  createdAt: string;
  updatedAt: string;
}

export interface IntentDetail extends IntentSummary {
  entryConditionJson: string;
  evidenceJson: string;
  metaJson: string;
}

export interface IntentTreeNode extends IntentSummary {
  children: IntentTreeNode[];
}
