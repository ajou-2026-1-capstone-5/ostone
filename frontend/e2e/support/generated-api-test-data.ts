export const workspace = { id: 1, name: "QA Workspace", description: "E2E workspace" };

export const pack = {
  packId: 1,
  name: "Generated API Pack",
  description: "E2E domain pack",
  versions: [{ versionId: 1, versionNo: 1, lifecycleStatus: "DRAFT", summaryJson: "{}" }],
};

export const policy = {
  id: 101,
  domainPackVersionId: 1,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: "환불 승인 조건",
  severity: "HIGH",
  conditionJson: '{"channel":"web"}',
  actionJson: '{"type":"REFUND_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

export const risk = {
  id: 201,
  domainPackVersionId: 1,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  description: "부정 거래 징후",
  riskLevel: "HIGH",
  triggerConditionJson: '{"amount":100000}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

export const slot = {
  id: 301,
  domainPackVersionId: 1,
  slotCode: "SLOT_ADDRESS",
  name: "배송 주소",
  description: "배송지 주소",
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: '{"required":true}',
  defaultValueJson: "{}",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

export const workflow = {
  id: 401,
  domainPackVersionId: 1,
  intentDefinitionId: 501,
  workflowCode: "WF_REFUND",
  name: "환불 처리",
  description: "환불 workflow",
  initialState: "START",
  terminalStatesJson: '["DONE"]',
  graphJson: null,
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

export const consultationSession = {
  id: 601,
  status: "ACTIVE",
  channel: "카카오톡",
  metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
  startedAt: "2026-05-22T00:00:00Z",
  assignedCounselorId: 7,
};
