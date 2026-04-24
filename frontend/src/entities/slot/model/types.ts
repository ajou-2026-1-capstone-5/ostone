export interface SlotDefinition {
  id: number;
  domainPackVersionId: number;
  slotCode: string;
  name: string;
  description: string | null;
  dataType: string;
  isSensitive: boolean;
  validationRuleJson: string;
  defaultValueJson: string | null;
  metaJson: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface SlotSummary {
  id: number;
  domainPackVersionId: number;
  slotCode: string;
  name: string;
  description: string | null;
  dataType: string;
  isSensitive: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface UpdateSlotRequest {
  name: string;
  description?: string | null;
  isSensitive?: boolean | null;
  validationRuleJson?: string | null;
  defaultValueJson?: string | null;
  metaJson?: string | null;
}

export interface UpdateSlotStatusRequest {
  status: "ACTIVE" | "INACTIVE";
}
