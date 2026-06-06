import { expect, type Page, type Route, type TestInfo } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const WORKSPACE_ID = 1;
const PACK_ID = 1;
const VERSION_ID = 1;
const WORKFLOW_ID = 401;
const INTENT_ID = 501;
const DATASET_ID = 77;
const PIPELINE_JOB_ID = 900;
const SIMULATION_SESSION_ID = 8801;
const SIMULATION_GOLDEN_CASE_ID = 9951;
const SIMULATION_REPLAY_SESSION_ID = 9952;

export const e2eIds = {
  workspaceId: WORKSPACE_ID,
  packId: PACK_ID,
  versionId: VERSION_ID,
  workflowId: WORKFLOW_ID,
  intentId: INTENT_ID,
  datasetId: DATASET_ID,
  pipelineJobId: PIPELINE_JOB_ID,
  simulationSessionId: SIMULATION_SESSION_ID,
} as const;

type RouteHandler = (route: Route, method: string, path: string, url: URL) => Promise<boolean>;

interface DomainPackMockState {
  currentVersionId: number;
  currentVersionNo: number;
  draftApproval: "blocked" | "ready";
  draftLifecycleStatus: "DRAFT" | "PUBLISHED";
  draftDescription: string;
}

export interface AppApiMockOptions {
  readonly domainPackDraftApproval?: "blocked" | "ready";
  readonly uploadLatestPipelineJob?: "default" | "none";
  readonly domainPackGenerationFailureAttempts?: number;
  readonly dashboardKnowledgePackHealth?: "default" | "error";
}

interface PipelineReviewMockState {
  pipelineReviewStatusRequests: Record<number, number>;
  domainPackGenerationFailuresRemaining: number;
}

const now = "2026-06-04T09:00:00+09:00";

const workspace = {
  id: WORKSPACE_ID,
  workspaceKey: "qa-workspace",
  name: "QA Workspace",
  description: "E2E workspace",
  status: "ACTIVE",
  myRole: "OWNER",
  createdAt: "2026-05-01T00:00:00+09:00",
  updatedAt: now,
};

const secondaryWorkspace = {
  id: 2,
  workspaceKey: "ops-workspace",
  name: "Ops Workspace",
  description: "E2E secondary workspace",
  status: "ACTIVE",
  myRole: "OPERATOR",
  createdAt: "2026-05-02T00:00:00+09:00",
  updatedAt: now,
};

const packSummary = {
  packId: PACK_ID,
  workspaceId: WORKSPACE_ID,
  name: "Generated API Pack",
  description: "상담 로그에서 생성된 환불 자동화 팩",
  status: "ACTIVE",
  currentVersionId: VERSION_ID,
  currentVersionNo: 1,
  currentVersionPublishedAt: "2026-05-22T00:00:00+09:00",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

const idlePackSummary = {
  packId: 2,
  workspaceId: WORKSPACE_ID,
  name: "검토 대기 팩",
  description: "아직 운영 버전이 없는 도메인팩",
  status: "DRAFT",
  currentVersionId: undefined,
  currentVersionNo: undefined,
  createdAt: "2026-06-01T00:00:00+09:00",
  updatedAt: now,
};

const summaryJson = JSON.stringify({
  topic: "환불 자동화 팩",
  generation: { source: "pipeline", clusterCount: 12 },
  quality: { mappingRate: 0.82, outlierRate: 0.07, workflowSeparability: 0.76 },
  review: { needsReviewCount: 3, topIssues: ["워크플로우 미매핑"] },
});

const packDetail = {
  ...packSummary,
  code: "PACK_REFUND",
  versions: [
    {
      versionId: VERSION_ID,
      packId: PACK_ID,
      versionNo: 1,
      lifecycleStatus: "PUBLISHED",
      summaryJson,
      description: "운영 중인 환불 상담 자동화 버전",
      intentCount: 1,
      slotCount: 1,
      policyCount: 1,
      riskCount: 1,
      workflowCount: 1,
      createdAt: "2026-05-22T00:00:00+09:00",
      updatedAt: now,
    },
    {
      versionId: 2,
      packId: PACK_ID,
      versionNo: 2,
      lifecycleStatus: "PUBLISHED",
      summaryJson: JSON.stringify({
        topic: "환불 자동화 팩 v2",
        generation: { source: "pipeline", clusterCount: 14 },
        quality: {
          mappingRate: 0.88,
          outlierRate: 0.04,
          workflowSeparability: 0.81,
        },
        review: { needsReviewCount: 1, topIssues: ["상담사 연결 조건 보강"] },
      }),
      description: "상담사 연결 조건을 보강한 운영 가능 버전",
      intentCount: 1,
      slotCount: 1,
      policyCount: 1,
      riskCount: 1,
      workflowCount: 1,
      createdAt: "2026-05-25T00:00:00+09:00",
      updatedAt: now,
    },
    {
      versionId: 3,
      packId: PACK_ID,
      versionNo: 3,
      lifecycleStatus: "DRAFT",
      summaryJson: JSON.stringify({
        topic: "환불 자동화 팩 v3 검토본",
        review: { topIssues: ["고액 환불 안내 문구 검토"] },
      }),
      description: "고액 환불 검토 흐름을 정리한 수정 검토본",
      intentCount: 1,
      slotCount: 1,
      policyCount: 1,
      riskCount: 1,
      workflowCount: 1,
      createdAt: "2026-05-28T00:00:00+09:00",
      updatedAt: now,
    },
  ],
};

const versionDetail = {
  ...packDetail.versions[0],
  finalMessage: "환불 문의 처리를 기준으로 도메인팩을 구성했습니다.",
};

const deployableVersionDetail = {
  ...packDetail.versions[1],
  finalMessage: "상담사 연결 조건을 보강했습니다.",
};

const draftVersionDetail = {
  ...packDetail.versions[2],
  finalMessage: "고액 환불 검토 흐름을 정리했습니다.",
};

function buildWorkspacePackSummary(state: DomainPackMockState) {
  return {
    ...packSummary,
    currentVersionId: state.currentVersionId,
    currentVersionNo: state.currentVersionNo,
    currentVersionPublishedAt:
      state.currentVersionId === VERSION_ID ? packSummary.currentVersionPublishedAt : now,
    updatedAt: state.currentVersionId === VERSION_ID ? packSummary.updatedAt : now,
  };
}

function buildDraftVersionSummary(state: DomainPackMockState) {
  return {
    ...packDetail.versions[2],
    lifecycleStatus: state.draftLifecycleStatus,
    description: state.draftDescription,
  };
}

function buildDraftVersionDetail(state: DomainPackMockState) {
  return {
    ...draftVersionDetail,
    ...buildDraftVersionSummary(state),
  };
}

function buildWorkspacePackDetail(state: DomainPackMockState) {
  return {
    ...packDetail,
    ...buildWorkspacePackSummary(state),
    code: packDetail.code,
    versions: [packDetail.versions[0], packDetail.versions[1], buildDraftVersionSummary(state)],
  };
}

const intent = {
  id: INTENT_ID,
  domainPackVersionId: VERSION_ID,
  intentCode: "INT_REFUND",
  name: "환불 문의",
  description: "고객이 결제 취소나 환불 가능 여부를 문의하는 상담 유형",
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: JSON.stringify({
    clusterId: 12,
    clusterSize: 36,
    canonicalIntent: "환불 문의",
    keywords: ["환불", "취소", "결제"],
    segmentIds: ["seg-1", "seg-2"],
    source: "intent_discovery_v1",
  }),
  entryConditionJson: JSON.stringify({ requiredAnyTerms: ["환불", "취소"] }),
  evidenceJson: JSON.stringify({
    sampleSegmentTexts: [
      "고객: 결제한 상품을 환불하고 싶어요.",
      "상담사: 주문번호를 알려주시면 환불 가능 여부를 확인하겠습니다.",
    ],
  }),
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

const slot = {
  id: 301,
  domainPackVersionId: VERSION_ID,
  slotCode: "SLOT_ORDER_ID",
  name: "주문번호",
  description: "환불 대상 주문을 식별하는 번호",
  dataType: "STRING",
  isSensitive: false,
  validationRuleJson: JSON.stringify({ pattern: "^ORD-" }),
  defaultValueJson: "{}",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

const policy = {
  id: 101,
  domainPackVersionId: VERSION_ID,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  description: "결제 후 7일 이내 미사용 주문은 자동 환불을 안내합니다.",
  severity: "HIGH",
  conditionJson: JSON.stringify({ daysSincePayment: { lte: 7 }, used: false }),
  actionJson: JSON.stringify({ type: "REFUND_REVIEW" }),
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

const risk = {
  id: 201,
  domainPackVersionId: VERSION_ID,
  riskCode: "RISK_FRAUD",
  name: "부정 환불 위험",
  description: "반복 환불 또는 고액 환불은 상담사 검토로 넘깁니다.",
  riskLevel: "HIGH",
  triggerConditionJson: JSON.stringify({ refundCount30d: { gte: 3 } }),
  handlingActionJson: JSON.stringify({ type: "MANUAL_REVIEW" }),
  evidenceJson: "[]",
  metaJson: "{}",
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

const workflowGraph = {
  direction: "LR",
  nodes: [
    { id: "start", type: "start", label: "문의 접수" },
    { id: "check", type: "decision", label: "환불 조건 확인" },
    { id: "done", type: "terminal", label: "환불 안내 완료" },
  ],
  edges: [
    { id: "e1", source: "start", target: "check", label: "주문번호 확인" },
    { id: "e2", source: "check", target: "done", label: "정책 충족" },
  ],
};

const workflow = {
  id: WORKFLOW_ID,
  domainPackVersionId: VERSION_ID,
  intentDefinitionId: INTENT_ID,
  workflowCode: "WF_REFUND",
  name: "환불 처리",
  description: "주문번호를 확인하고 환불 정책에 따라 안내하는 workflow",
  initialState: "start",
  terminalStatesJson: JSON.stringify(["done"]),
  graphJson: JSON.stringify(workflowGraph),
  evidenceJson: "{}",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00+09:00",
  updatedAt: now,
};

type DomainPackComponentSection = "intents" | "slots" | "policies" | "risks" | "workflows";

function componentPreviewData(
  state: DomainPackMockState,
  versionId: number,
  section: DomainPackComponentSection,
) {
  const suffix = versionId === 3 ? "고액 환불" : "상담사 연결";

  if (section === "intents") {
    return [
      {
        ...intent,
        domainPackVersionId: versionId,
        name: `${suffix} 문의`,
        status: versionId === 3 && state.draftApproval === "blocked" ? "DRAFT" : intent.status,
      },
    ];
  }

  if (section === "slots") {
    return [{ ...slot, domainPackVersionId: versionId, name: `${suffix} 주문번호` }];
  }

  if (section === "policies") {
    return [{ ...policy, domainPackVersionId: versionId, name: `${suffix} 정책` }];
  }

  if (section === "risks") {
    return [{ ...risk, domainPackVersionId: versionId, name: `${suffix} 위험` }];
  }

  return [
    {
      ...workflow,
      domainPackVersionId: versionId,
      name: `${suffix} 검토 워크플로우`,
    },
  ];
}

const members = [
  {
    memberId: 1,
    userId: 7,
    name: "김상담",
    email: "agent@example.com",
    workspaceRole: "OPERATOR",
    joinedAt: "2026-05-01T00:00:00+09:00",
    accountStatus: "ACTIVE",
  },
  {
    memberId: 2,
    userId: 8,
    name: "박리뷰",
    email: "reviewer@example.com",
    workspaceRole: "REVIEWER",
    joinedAt: "2026-05-03T00:00:00+09:00",
    accountStatus: "ACTIVE",
  },
];

const subscription = {
  id: 11,
  workspaceId: WORKSPACE_ID,
  planKey: "PRO",
  status: "ACTIVE",
  currentPeriodStart: "2026-06-01T00:00:00+09:00",
  currentPeriodEnd: "2026-07-01T00:00:00+09:00",
  cancelAtPeriodEnd: false,
  customerKey: "customer-qa-workspace",
  memberLimit: 20,
  datasetUploadLimit: 100,
  pipelineRunLimit: 50,
};

const payment = {
  id: 7001,
  orderId: "order-7001",
  paymentKey: "pay_7001",
  amount: 99000,
  currency: "KRW",
  status: "DONE",
  method: "카드",
  approvedAt: "2026-06-01T09:30:00+09:00",
  receiptUrl: "https://receipt.example.test/pay_7001",
  createdAt: "2026-06-01T09:29:30+09:00",
};

const billingOverview = {
  subscription,
  billingKey: {
    id: 15,
    cardCompany: "신한카드",
    cardNumberMasked: "1234-****-****-5678",
    status: "ACTIVE",
  },
  payments: [payment],
  quotaUsages: [
    { resource: "DATASET_UPLOAD", used: 4, limit: 100 },
    { resource: "PIPELINE_RUN", used: 9, limit: 50 },
  ],
};

const secondarySubscription = {
  ...subscription,
  id: 22,
  workspaceId: secondaryWorkspace.id,
  customerKey: "customer-ops-workspace",
};

const secondaryPayment = {
  ...payment,
  id: 7002,
  orderId: "order-7002",
  paymentKey: "pay_7002",
  amount: 49000,
  status: "DONE",
  receiptUrl: "https://receipt.example.test/pay_7002",
};

const secondaryBillingOverview = {
  subscription: secondarySubscription,
  billingKey: {
    id: 25,
    cardCompany: "국민카드",
    cardNumberMasked: "9876-****-****-4321",
    status: "ACTIVE",
  },
  payments: [secondaryPayment],
  quotaUsages: [
    { resource: "DATASET_UPLOAD", used: 1, limit: 100 },
    { resource: "PIPELINE_RUN", used: 2, limit: 50 },
  ],
};

function createBillingMockState() {
  return {
    workspaceOneOverview: {
      ...billingOverview,
      subscription: { ...subscription },
      billingKey: { ...billingOverview.billingKey },
      payments: [{ ...payment }],
      quotaUsages: billingOverview.quotaUsages.map((quota) => ({ ...quota })),
    },
    workspaceTwoOverview: {
      ...secondaryBillingOverview,
      subscription: { ...secondarySubscription },
      billingKey: { ...secondaryBillingOverview.billingKey },
      payments: [{ ...secondaryPayment }],
      quotaUsages: secondaryBillingOverview.quotaUsages.map((quota) => ({ ...quota })),
    },
  };
}

type BillingMockState = ReturnType<typeof createBillingMockState>;

const consultationSession = {
  id: 601,
  workspaceId: WORKSPACE_ID,
  status: "COMPLETED",
  channel: "WEB",
  metaJson: JSON.stringify({
    customerName: "김민지",
    title: "김민지",
    handoffReason: "환불 문의",
    messageCount: 2,
    lastMessagePreview: "주문번호를 알려주시면 환불 가능 여부를 확인하겠습니다.",
    resolution: { label: "환불 문의", reason: "환불 가능 여부 안내 완료" },
  }),
  startedAt: "2026-06-04T09:00:00+09:00",
  completedAt: "2026-06-04T09:08:00+09:00",
  assignedCounselorId: 7,
  responseMode: "AI_ASSIST_ONLY",
};

const followUpConsultationSession = {
  id: 602,
  workspaceId: WORKSPACE_ID,
  status: "RESOLVED",
  channel: "KAKAO",
  metaJson: JSON.stringify({
    customerName: "이준호",
    title: "이준호",
    handoffReason: "배송 문의",
    messageCount: 3,
    lastMessagePreview: "배송 예정일을 다시 안내했습니다.",
    resolution: {
      label: "배송 안내",
      reason: "주소 변경 요청 확인",
      followUpRequired: true,
    },
  }),
  startedAt: "2026-06-03T13:00:00+09:00",
  completedAt: "2026-06-03T13:12:00+09:00",
  assignedCounselorId: 8,
  responseMode: "AI_ASSIST_ONLY",
};

const consultationSessions = [consultationSession, followUpConsultationSession];

const chatMessages = [
  {
    id: 701,
    seqNo: 1,
    senderRole: "CUSTOMER",
    messageType: "TEXT",
    content: "환불 가능한지 확인해주세요.",
    createdAt: "2026-06-04T09:01:00+09:00",
  },
  {
    id: 702,
    seqNo: 2,
    senderRole: "ASSISTANT",
    messageType: "TEXT",
    content: "주문번호를 알려주시면 환불 가능 여부를 확인하겠습니다.",
    createdAt: "2026-06-04T09:01:20+09:00",
  },
];

const olderChatMessages = [
  {
    id: 700,
    seqNo: 0,
    senderRole: "SYSTEM",
    messageType: "TEXT",
    content: "환불 상담 세션이 시작되었습니다.",
    createdAt: "2026-06-04T09:00:30+09:00",
  },
];

const simulationSession = {
  id: SIMULATION_SESSION_ID,
  workspaceId: WORKSPACE_ID,
  status: "ACTIVE",
  channel: "SIMULATION",
  metaJson: JSON.stringify({ customerName: "시뮬레이션 고객" }),
  startedAt: "2026-06-04T09:10:00+09:00",
  assignedCounselorId: null,
  responseMode: "AI_ACTIVE",
};

const simulationFeedback = {
  id: 9901,
  workspaceId: WORKSPACE_ID,
  sessionId: SIMULATION_SESSION_ID,
  chatMessageId: null,
  feedbackType: "INTENT_MISMATCH",
  description: "환불 문의가 배송 문의로 분류되는 경우가 있습니다.",
  expectedBehavior: "환불 intent로 매칭해야 합니다.",
  severity: "MEDIUM",
  status: "OPEN",
  createdBy: 7,
  createdAt: now,
  updatedAt: now,
};

const improvementCandidate = {
  id: 9911,
  workspaceId: WORKSPACE_ID,
  domainPackVersionId: VERSION_ID,
  feedbackId: simulationFeedback.id,
  sessionId: SIMULATION_SESSION_ID,
  chatMessageId: null,
  candidateType: "INTENT_DESCRIPTION_EXAMPLE",
  targetElementType: "INTENT",
  targetElementId: INTENT_ID,
  targetElementKey: "INT_REFUND",
  beforeSummary: "환불 intent 예시가 결제 취소 중심입니다.",
  afterSummary: "부분 환불과 반복 환불 표현을 예시에 추가합니다.",
  evidenceSummary: "시뮬레이션 피드백 #9901",
  status: "DRAFT",
  createdBy: 7,
  createdAt: now,
  updatedAt: now,
};

const simulationReplayResult = {
  id: 9961,
  workspaceId: WORKSPACE_ID,
  goldenCaseId: SIMULATION_GOLDEN_CASE_ID,
  domainPackVersionId: 2,
  replaySessionId: SIMULATION_REPLAY_SESSION_ID,
  status: "PASS",
  expectedJson: JSON.stringify({
    intentCode: "INT_REFUND",
    workflowCode: "WF_REFUND",
    currentState: "환불 조건 확인",
    actionType: "ASK_SLOT",
    slotValues: { orderId: "ORD-20260604" },
  }),
  actualJson: JSON.stringify({
    intentCode: "INT_REFUND",
    workflowCode: "WF_REFUND",
    currentState: "환불 조건 확인",
    actionType: "ASK_SLOT",
    slotValues: { orderId: "ORD-20260604" },
  }),
  failureSummary: null,
  createdBy: 7,
  createdAt: now,
};

type SimulationReplayResultMock = typeof simulationReplayResult;

type SimulationCandidateStatus = "DRAFT" | "READY_FOR_REVIEW" | "APPLIED" | "REJECTED";

type SimulationCandidateMock = Omit<
  typeof improvementCandidate,
  "status" | "targetElementId" | "targetElementKey"
> & {
  targetElementId: number | null;
  targetElementKey: string | null;
  reviewSessionId: number | null;
  reviewTaskId: number | null;
  appliedDomainPackVersionId: number | null;
  decisionReason: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  status: SimulationCandidateStatus;
};

type SimulationGoldenCaseMock = {
  id: number;
  workspaceId: number;
  sourceSessionId: number;
  sourceDomainPackVersionId: number;
  name: string;
  inputMessagesJson: string;
  expectedJson: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  latestReplayResult: SimulationReplayResultMock | null;
};

type SimulationMockState = {
  messages: typeof chatMessages;
  goldenCases: SimulationGoldenCaseMock[];
  candidates: SimulationCandidateMock[];
};

function buildSimulationCandidate(
  overrides: Partial<SimulationCandidateMock> = {},
): SimulationCandidateMock {
  return {
    ...improvementCandidate,
    reviewSessionId: null,
    reviewTaskId: null,
    appliedDomainPackVersionId: null,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    status: "DRAFT",
    ...overrides,
  };
}

const draftImprovementCandidate = buildSimulationCandidate();

const approvalImprovementCandidate = buildSimulationCandidate({
  id: 9912,
  candidateType: "SLOT_QUESTION",
  targetElementType: "SLOT",
  targetElementId: slot.id,
  targetElementKey: slot.slotCode,
  beforeSummary: "부분 환불 문의는 주문번호 확인 질문으로 이어지지 않습니다.",
  afterSummary: "부분 환불 문의도 주문번호를 먼저 확인하도록 질문을 보강합니다.",
  evidenceSummary: "시뮬레이션 피드백 #9902",
  status: "READY_FOR_REVIEW",
  reviewSessionId: 9201,
  reviewTaskId: 9301,
});

const rejectionImprovementCandidate = buildSimulationCandidate({
  id: 9913,
  candidateType: "HANDOFF_CONDITION",
  targetElementType: "HANDOFF",
  targetElementId: null,
  targetElementKey: "refund_handoff",
  beforeSummary: "고액 환불을 모두 상담사에게 넘기도록 제안합니다.",
  afterSummary: "고액 환불 handoff 조건을 완화합니다.",
  evidenceSummary: "시뮬레이션 피드백 #9903",
  status: "READY_FOR_REVIEW",
  reviewSessionId: 9202,
  reviewTaskId: 9302,
});

function createSimulationState(): SimulationMockState {
  return {
    messages: chatMessages,
    goldenCases: [],
    candidates: [
      { ...draftImprovementCandidate },
      { ...approvalImprovementCandidate },
      { ...rejectionImprovementCandidate },
    ],
  };
}

function upsertSimulationCandidate(
  state: SimulationMockState,
  candidate: SimulationCandidateMock,
) {
  const withoutCandidate = state.candidates.filter((item) => item.id !== candidate.id);
  state.candidates = [...withoutCandidate, { ...candidate }];
}

function updateSimulationCandidate(
  state: SimulationMockState,
  candidateId: number,
  updates: Partial<SimulationCandidateMock>,
) {
  const current = state.candidates.find((candidate) => candidate.id === candidateId);
  if (!current) {
    throw new Error(`Unknown simulation candidate: ${candidateId}`);
  }
  const updated = { ...current, ...updates };
  state.candidates = state.candidates.map((candidate) =>
    candidate.id === candidateId ? updated : candidate,
  );
  return updated;
}

function simulationDetail(messages: typeof chatMessages = chatMessages) {
  return {
    session: simulationSession,
    messages,
    matchedWorkflow: {
      intentCode: "INT_REFUND",
      intentName: "환불 문의",
      domainPackVersionId: VERSION_ID,
      workflowCode: "WF_REFUND",
      workflowName: "환불 처리",
      currentState: "환불 조건 확인",
      executionStatus: "RUNNING",
    },
    slotValues: { orderId: "ORD-20260604" },
    slots: [{ key: "orderId", value: "ORD-20260604" }],
    feedback: {
      items: [simulationFeedback],
      messageFeedbackCounts: { "702": 1 },
    },
  };
}

function goldenCasePage(content: SimulationGoldenCaseMock[]) {
  return {
    content,
    page: 0,
    size: 20,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
  };
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function installTrackedApiRoute(page: Page, seen: string[], handler: RouteHandler) {
  return page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const method = request.method();
    seen.push(`${method} ${path}${url.search}`);

    if (await handler(route, method, path, url)) {
      return;
    }

    return fulfillJson(route, { code: "E2E_UNMOCKED", message: `${method} ${path}` }, 500);
  });
}

function parseSessionMeta(session: (typeof consultationSessions)[number]) {
  try {
    return JSON.parse(session.metaJson) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function filterConsultationSessions(url: URL) {
  const status = url.searchParams.get("status") ?? "";
  const keyword = (url.searchParams.get("keyword") ?? "").trim().toLowerCase();
  const startedFrom = url.searchParams.get("startedFrom") ?? "";
  const startedTo = url.searchParams.get("startedTo") ?? "";
  const assignedCounselorId = url.searchParams.get("assignedCounselorId") ?? "";

  return consultationSessions.filter((session) => {
    const meta = parseSessionMeta(session);
    const searchable = [
      session.channel,
      session.status,
      meta.customerName,
      meta.title,
      meta.handoffReason,
      meta.lastMessagePreview,
    ]
      .filter((value): value is string => typeof value === "string")
      .join(" ")
      .toLowerCase();
    const startedDate = session.startedAt.slice(0, 10);
    const matchesStatus = status ? session.status === status : true;
    const matchesKeyword = keyword ? searchable.includes(keyword) : true;
    const matchesStartedFrom = startedFrom ? startedDate >= startedFrom : true;
    const matchesStartedTo = startedTo ? startedDate <= startedTo : true;
    const matchesCounselor = assignedCounselorId
      ? String(session.assignedCounselorId) === assignedCounselorId
      : true;

    return (
      matchesStatus && matchesKeyword && matchesStartedFrom && matchesStartedTo && matchesCounselor
    );
  });
}

async function fulfillWorkspaceShell(route: Route, method: string, path: string): Promise<boolean> {
  if (method === "GET" && path === "/workspaces") {
    await fulfillJson(route, [workspace, secondaryWorkspace]);
    return true;
  }

  if (method === "GET" && path === "/workspaces/1") {
    await fulfillJson(route, workspace);
    return true;
  }

  if (method === "GET" && path === "/workspaces/2") {
    await fulfillJson(route, secondaryWorkspace);
    return true;
  }

  return false;
}

async function fulfillDomainPackRead(
  route: Route,
  method: string,
  path: string,
  state: DomainPackMockState,
): Promise<boolean> {
  const domainPackWorkspacePrefix =
    path.startsWith("/workspaces/1/domain-packs")
      ? "/workspaces/1"
      : path.startsWith("/workspaces/2/domain-packs")
        ? "/workspaces/2"
        : null;

  if (method === "GET" && path === `${domainPackWorkspacePrefix}/domain-packs`) {
    const summaries =
      domainPackWorkspacePrefix === "/workspaces/1"
        ? [buildWorkspacePackSummary(state), idlePackSummary]
        : [{ ...packSummary, workspaceId: 2, name: "Ops Workflow Pack" }];
    await fulfillJson(route, { data: summaries, status: 200 });
    return true;
  }

  if (method === "GET" && path === `${domainPackWorkspacePrefix}/domain-packs/1`) {
    await fulfillJson(route, {
      data:
        domainPackWorkspacePrefix === "/workspaces/1"
          ? buildWorkspacePackDetail(state)
          : { ...packDetail, workspaceId: 2, name: "Ops Workflow Pack" },
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/2") {
    await fulfillJson(route, {
      data: {
        ...idlePackSummary,
        code: "PACK_PENDING",
        versions: [],
      },
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1") {
    await fulfillJson(route, { data: versionDetail, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/2") {
    await fulfillJson(route, { data: deployableVersionDetail, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/3") {
    await fulfillJson(route, { data: buildDraftVersionDetail(state), status: 200 });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/domain-packs/1/versions/2/deploy") {
    state.currentVersionId = 2;
    state.currentVersionNo = 2;
    await fulfillJson(route, {
      data: {
        id: 2,
        domainPackId: PACK_ID,
        versionNo: 2,
        lifecycleStatus: "PUBLISHED",
        publishedAt: now,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/domain-packs/1/versions/3/activate") {
    const postData = route.request().postData();
    const requestBody = postData ? (JSON.parse(postData) as { description?: string }) : undefined;
    if (requestBody) {
      expect(requestBody).toEqual({
        description: expect.any(String),
      });
    }
    const description = requestBody?.description ?? state.draftDescription;
    state.currentVersionId = 3;
    state.currentVersionNo = 3;
    state.draftLifecycleStatus = "PUBLISHED";
    state.draftDescription = description;
    await fulfillJson(route, {
      data: {
        id: 3,
        domainPackId: PACK_ID,
        versionNo: 3,
        lifecycleStatus: "PUBLISHED",
        description,
        publishedAt: now,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (method === "DELETE" && path === "/workspaces/1/domain-packs/1/versions/3/draft") {
    await fulfillJson(route, { data: null, status: 200 });
    return true;
  }

  const componentListMatch = path.match(
    /^\/workspaces\/1\/domain-packs\/1\/versions\/([23])\/(intents|slots|policies|risks|workflows)$/,
  );
  if (method === "GET" && componentListMatch) {
    const versionId = Number(componentListMatch[1]);
    const section = componentListMatch[2] as DomainPackComponentSection;
    await fulfillJson(route, {
      data: componentPreviewData(state, versionId, section),
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/intents") {
    await fulfillJson(route, { data: [intent], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/intents/501") {
    await fulfillJson(route, { data: intent, status: 200 });
    return true;
  }

  if (
    method === "GET" &&
    path === "/workspaces/1/domain-packs/1/versions/1/intents/501/workflows"
  ) {
    await fulfillJson(route, { data: [workflow], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots") {
    await fulfillJson(route, { data: [slot], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/slots/301") {
    await fulfillJson(route, { data: slot, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies") {
    await fulfillJson(route, { data: [policy], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/policies/101") {
    await fulfillJson(route, { data: policy, status: 200 });
    return true;
  }

  if (method === "PATCH" && path === "/workspaces/1/domain-packs/1/versions/1/policies/101") {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      data: {
        ...policy,
        ...body,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (
    method === "PATCH" &&
    path === "/workspaces/1/domain-packs/1/versions/1/policies/101/status"
  ) {
    const body = route.request().postDataJSON() as { status?: string };
    await fulfillJson(route, {
      data: {
        ...policy,
        status: body.status,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks") {
    await fulfillJson(route, { data: [risk], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/risks/201") {
    await fulfillJson(route, { data: risk, status: 200 });
    return true;
  }

  if (method === "PATCH" && path === "/workspaces/1/domain-packs/1/versions/1/risks/201") {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    await fulfillJson(route, {
      data: {
        ...risk,
        ...body,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (method === "PATCH" && path === "/workspaces/1/domain-packs/1/versions/1/risks/201/status") {
    const body = route.request().postDataJSON() as { status?: string };
    await fulfillJson(route, {
      data: {
        ...risk,
        status: body.status,
        updatedAt: now,
      },
      status: 200,
    });
    return true;
  }

  if (
    method === "GET" &&
    path === `${domainPackWorkspacePrefix}/domain-packs/1/versions/1/workflows`
  ) {
    await fulfillJson(route, { data: [workflow], status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/domain-packs/1/versions/1/workflows/401") {
    await fulfillJson(route, { data: workflow, status: 200 });
    return true;
  }

  if (
    method === "GET" &&
    path === "/workspaces/1/domain-packs/1/versions/1/workflows/401/transitions"
  ) {
    await fulfillJson(route, { data: [], status: 200 });
    return true;
  }

  return false;
}

async function fulfillBilling(
  route: Route,
  method: string,
  path: string,
  state: BillingMockState,
): Promise<boolean> {
  if (method === "GET" && path === "/plans") {
    await fulfillJson(route, {
      data: [
        {
          planKey: "pro_monthly",
          name: "Pro (Monthly)",
          amount: 29000,
          currency: "KRW",
          interval: "MONTH",
          memberLimit: 3,
          datasetUploadLimit: 10,
          pipelineRunHourlyLimit: 1,
          contactOnly: false,
          unlimited: false,
        },
      ],
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/subscription") {
    await fulfillJson(route, { data: state.workspaceOneOverview.subscription, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/billing/overview") {
    await fulfillJson(route, { data: state.workspaceOneOverview, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/2/billing/overview") {
    await fulfillJson(route, { data: state.workspaceTwoOverview, status: 200 });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/payments/pay_7001/cancel") {
    expect(route.request().postDataJSON()).toEqual({ cancelReason: "품질 검증 환불" });
    const canceledPayment = { ...payment, status: "CANCELED" };
    state.workspaceOneOverview = {
      ...state.workspaceOneOverview,
      payments: [canceledPayment],
    };
    await fulfillJson(route, { data: canceledPayment, status: 200 });
    return true;
  }

  if (method === "DELETE" && path === "/workspaces/1/subscription") {
    const canceledSubscription = { ...subscription, status: "CANCELED", cancelAtPeriodEnd: true };
    state.workspaceOneOverview = {
      ...state.workspaceOneOverview,
      subscription: canceledSubscription,
    };
    await fulfillJson(route, { data: canceledSubscription, status: 200 });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/billing/authorizations") {
    expect(route.request().postDataJSON()).toMatchObject({
      authKey: "auth-e2e",
      customerKey: "customer-qa-workspace",
    });
    await fulfillJson(route, {
      data: {
        subscription: state.workspaceOneOverview.subscription,
        billingKey: state.workspaceOneOverview.billingKey,
      },
      status: 200,
    });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/payments/confirm") {
    expect(route.request().postDataJSON()).toMatchObject({
      paymentKey: "payment-e2e",
      orderId: "order-e2e",
      amount: 99000,
    });
    await fulfillJson(route, { data: payment, status: 200 });
    return true;
  }

  return false;
}

async function fulfillWorkspaceOperations(
  route: Route,
  method: string,
  path: string,
  url: URL,
  options: AppApiMockOptions,
): Promise<boolean> {
  if (method === "GET" && path === "/workspaces/1/members") {
    const q = url.searchParams.get("q")?.toLowerCase() ?? "";
    const role = url.searchParams.get("role") ?? "";
    const filtered = members.filter((member) => {
      const matchesSearch = q ? `${member.name} ${member.email}`.toLowerCase().includes(q) : true;
      const matchesRole = role ? member.workspaceRole === role : true;
      return matchesSearch && matchesRole;
    });
    await fulfillJson(route, { data: filtered, status: 200 });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/consultation/metrics") {
    await fulfillJson(route, {
      workspaceId: WORKSPACE_ID,
      periodStart: "2026-05-29T00:00:00+09:00",
      periodEnd: now,
      totalConsultationCount: 38,
      completedConsultationCount: 31,
      averageFirstResponseSeconds: 72,
      averageLlmFirstResponseSeconds: 4,
      averageHumanFirstResponseSeconds: 180,
      llmHandledCount: 24,
      humanInterventionCount: 7,
      unresolvedSessionCount: 2,
      comparison: null,
      coverage: {
        workflowMatchedCount: 29,
        workflowMatchRate: 0.76,
        intentClassificationSuccessCount: 31,
        intentClassificationSuccessRate: 0.82,
        lowConfidenceCount: 3,
        lowConfidenceRate: 0.08,
        unmatchedSessionCount: 4,
        autoCompletedWorkflowCount: 18,
        humanHandoffRate: 0.18,
        llmOnlyProcessingRate: 0.64,
        measurementStatus: "READY",
        measurementMessage: "측정 가능",
        trend: [
          {
            date: "2026-06-04",
            totalConsultationCount: 8,
            workflowMatchedCount: 6,
            workflowMatchRate: 0.75,
          },
        ],
      },
      handledTodayCount: 8,
      llmHandledTodayCount: 6,
      humanHandledTodayCount: 2,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/dashboard/workflow-rankings") {
    const topRanking = {
      rank: 1,
      workflowDefinitionId: WORKFLOW_ID,
      domainPackId: PACK_ID,
      domainPackVersionId: VERSION_ID,
      workflowCode: "WF_REFUND",
      workflowName: "환불 처리",
      executionCount: 18,
      shareRate: 0.47,
      completedCount: 16,
      failedCount: 1,
      runningCount: 1,
      completionRate: 0.89,
      failureRate: 0.05,
      averageHandlingSeconds: 210,
      humanInterventionRate: 0.12,
      changeRate: 0.18,
      surging: true,
      detailPath: `/workspaces/1/domain-packs/1/workflows/401?versionId=1`,
    };
    await fulfillJson(route, {
      workspaceId: WORKSPACE_ID,
      periodStart: "2026-05-29T00:00:00+09:00",
      periodEnd: now,
      totalConsultationCount: 38,
      rankings: [topRanking],
      topRankings: [topRanking],
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/dashboard/knowledge-pack-health") {
    if (options.dashboardKnowledgePackHealth === "error") {
      await fulfillJson(
        route,
        {
          code: "E2E_DASHBOARD_HEALTH_ERROR",
          message: "운영 지식팩 상태 조회 실패",
        },
        500,
      );
      return true;
    }

    await fulfillJson(route, {
      activeKnowledgePack: {
        packId: PACK_ID,
        packName: "Generated API Pack",
        versionId: VERSION_ID,
        versionNo: 1,
        publishedAt: "2026-05-22T00:00:00+09:00",
        createdAt: "2026-05-22T00:00:00+09:00",
        sourcePipelineJobId: PIPELINE_JOB_ID,
      },
      lastLogUpload: {
        datasetId: DATASET_ID,
        datasetKey: "dataset-refund-log",
        datasetName: "refund-log.zip",
        datasetStatus: "READY",
        uploadedAt: "2026-06-04T09:00:00+09:00",
      },
      lastKnowledgePackGeneration: {
        pipelineJobId: PIPELINE_JOB_ID,
        datasetId: DATASET_ID,
        domainPackId: PACK_ID,
        status: "WAITING_DOMAIN_CONFIRMATION",
        requestedAt: now,
        startedAt: now,
        finishedAt: null,
        lastErrorMessage: null,
      },
      pendingReviewCount: 1,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/dashboard/action-recommendations") {
    await fulfillJson(route, {
      workspaceId: WORKSPACE_ID,
      periodStart: "2026-05-29T00:00:00+09:00",
      periodEnd: now,
      recommendations: [
        {
          ruleCode: "PENDING_PIPELINE_REVIEW",
          priority: 1,
          title: "최신 도메인 후보 확정",
          description: "파이프라인이 발견한 환불 도메인을 확정하세요.",
          evidenceLabel: "대기 항목",
          evidenceValue: "1개",
          targetPath: `/workspaces/1/pipeline-jobs/${PIPELINE_JOB_ID}/review`,
        },
      ],
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/consultation/sessions") {
    const page = Number(url.searchParams.get("page") ?? "0");
    const size = Number(url.searchParams.get("size") ?? "20");
    const filtered = filterConsultationSessions(url);
    const pageSize = Number.isFinite(size) && size > 0 ? size : 20;
    const currentPage = Number.isFinite(page) && page >= 0 ? page : 0;
    const start = currentPage * pageSize;
    await fulfillJson(route, {
      content: filtered.slice(start, start + pageSize),
      page: currentPage,
      size: pageSize,
      totalElements: filtered.length,
      totalPages: Math.max(Math.ceil(filtered.length / pageSize), 1),
    });
    return true;
  }

  if (method === "GET" && path === "/consultation/sessions/601/messages") {
    const requestedPage = Number(url.searchParams.get("page") ?? "0");
    const currentPage = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 0;
    const content = currentPage === 1 ? olderChatMessages : chatMessages;
    await fulfillJson(route, {
      content,
      page: currentPage,
      size: 50,
      totalElements: chatMessages.length + olderChatMessages.length,
      totalPages: 2,
    });
    return true;
  }

  return false;
}

async function fulfillUploadAndReview(
  route: Route,
  method: string,
  path: string,
  options: AppApiMockOptions,
  state: PipelineReviewMockState,
): Promise<boolean> {
  if (method === "POST" && path === "/workspaces/1/datasets/uploads:init") {
    await fulfillJson(route, {
      datasetId: DATASET_ID,
      datasetKey: "dataset-refund-log",
      workspaceId: WORKSPACE_ID,
      uploadUrl: "http://127.0.0.1:3000/e2e-upload/raw-log.zip",
      objectKey: "raw/dataset-refund-log.zip",
      contentType: "application/zip",
      expiresInSeconds: 300,
      serverSideEncryptionRequired: false,
    });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/datasets/uploads/77:complete") {
    await fulfillJson(route, {
      datasetId: DATASET_ID,
      datasetKey: "dataset-refund-log",
      workspaceId: WORKSPACE_ID,
      objectKey: "raw/dataset-refund-log.zip",
      sizeBytes: 24,
      status: "READY",
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/datasets/77/pipeline-jobs/latest") {
    if (options.uploadLatestPipelineJob === "none") {
      await fulfillJson(route, { pipelineJob: null });
      return true;
    }

    await fulfillJson(route, {
      pipelineJob: {
        pipelineJobId: PIPELINE_JOB_ID,
        workspaceId: WORKSPACE_ID,
        datasetId: DATASET_ID,
        domainPackId: null,
        jobType: "INGESTION",
        status: "WAITING_DOMAIN_CONFIRMATION",
        airflowDagId: "domain_pack_generation",
        airflowRunId: "pipeline_job_900",
        requestedAt: "2026-06-05T01:00:00Z",
        startedAt: "2026-06-05T01:00:10Z",
        finishedAt: null,
        runningDurationSeconds: 90,
        lastErrorMessage: null,
      },
    });
    return true;
  }

  if (
    method === "POST" &&
    path === "/workspaces/1/datasets/77/pipeline-jobs/domain-pack-generation"
  ) {
    if (state.domainPackGenerationFailuresRemaining > 0) {
      state.domainPackGenerationFailuresRemaining -= 1;
      await fulfillJson(
        route,
        {
          code: "PIPELINE_REQUEST_FAILED",
          message:
            "도메인팩 초안 생성 요청에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        },
        500,
      );
      return true;
    }

    await fulfillJson(route, {
      data: {
        pipelineJobId: PIPELINE_JOB_ID,
        status: "WAITING_DOMAIN_CONFIRMATION",
      },
      status: 200,
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/pipeline-jobs/900/review-checkpoint") {
    await fulfillJson(route, {
      pipelineJobId: PIPELINE_JOB_ID,
      pipelineStatus: "WAITING_DOMAIN_CONFIRMATION",
      reviewKind: "DOMAIN_CONFIRMATION",
      tasks: [
        {
          id: 9101,
          targetType: "DOMAIN_CANDIDATE",
          status: "OPEN",
          priority: "HIGH",
          title: "환불/결제 도메인",
          payload: {
            displayName: "환불/결제 도메인",
            confidence: 0.91,
            description: "결제 취소, 환불 조건, 주문번호 확인 상담이 포함됩니다.",
            evidenceTerms: ["환불", "취소", "결제", "주문번호"],
          },
        },
      ],
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/pipeline-jobs/901/review-checkpoint") {
    await fulfillJson(route, {
      pipelineJobId: 901,
      pipelineStatus: "WAITING_HUMAN_FEEDBACK",
      reviewKind: "HUMAN_FEEDBACK",
      tasks: [
        {
          id: 9201,
          targetType: "FEEDBACK_PAIR",
          status: "OPEN",
          priority: "MEDIUM",
          title: "환불과 배송 지연 경계",
          payload: {
            questionText: "두 상담을 같은 intent로 묶어도 되나요?",
            reasonLabel: "클러스터 경계 확인",
            sourceReviewContext: {
              conversationId: "A-1",
              summary: "고객이 결제 환불 가능 여부를 문의함",
              action: "환불 확인",
              object: "주문",
              signals: ["환불", "결제"],
              turns: [{ role: "customer", text: "결제 취소하고 싶어요." }],
            },
            targetReviewContext: {
              conversationId: "B-1",
              summary: "고객이 배송 지연으로 취소를 요청함",
              action: "취소 요청",
              object: "배송",
              signals: ["배송", "취소"],
              turns: [{ role: "customer", text: "배송이 늦어서 취소하고 싶어요." }],
            },
          },
        },
      ],
    });
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/pipeline-jobs/902/review-checkpoint") {
    await fulfillJson(route, transitionCheckpoint(state, 902, "SUCCEEDED"));
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/pipeline-jobs/903/review-checkpoint") {
    await fulfillJson(route, transitionCheckpoint(state, 903, "FAILED"));
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/pipeline-jobs/904/review-checkpoint") {
    const checkpoint = failOnceThenCheckpoint(state, 904, "SUCCEEDED");
    await fulfillJson(route, checkpoint.body, checkpoint.status);
    return true;
  }

  if (
    method === "POST" &&
    path === "/workspaces/1/pipeline-jobs/900/review-checkpoint/domain-confirmation"
  ) {
    expect(route.request().postDataJSON()).toEqual({ reviewTaskId: 9101 });
    await fulfillJson(route, { data: { accepted: true }, status: 200 });
    return true;
  }

  if (
    method === "POST" &&
    path === "/workspaces/1/pipeline-jobs/901/review-checkpoint/human-feedback"
  ) {
    expect(route.request().postDataJSON()).toEqual({
      decisions: [{ reviewTaskId: 9201, decisionType: "cannot_link" }],
    });
    await fulfillJson(route, { data: { accepted: true }, status: 200 });
    return true;
  }

  return false;
}

function transitionCheckpoint(
  state: PipelineReviewMockState,
  pipelineJobId: number,
  finalStatus: "SUCCEEDED" | "FAILED",
) {
  const seenCount = state.pipelineReviewStatusRequests[pipelineJobId] ?? 0;
  state.pipelineReviewStatusRequests[pipelineJobId] = seenCount + 1;

  return {
    pipelineJobId,
    pipelineStatus: seenCount === 0 ? "RUNNING" : finalStatus,
    reviewKind: null,
    tasks: [],
  };
}

function failOnceThenCheckpoint(
  state: PipelineReviewMockState,
  pipelineJobId: number,
  finalStatus: "SUCCEEDED" | "FAILED",
) {
  const seenCount = state.pipelineReviewStatusRequests[pipelineJobId] ?? 0;
  state.pipelineReviewStatusRequests[pipelineJobId] = seenCount + 1;

  if (seenCount === 0) {
    return {
      status: 503,
      body: {
        code: "PIPELINE_REVIEW_STATUS_UNAVAILABLE",
        message: "파이프라인 상태를 확인할 수 없습니다.",
      },
    };
  }

  return {
    status: 200,
    body: {
      pipelineJobId,
      pipelineStatus: finalStatus,
      reviewKind: null,
      tasks: [],
    },
  };
}

async function fulfillSimulation(
  route: Route,
  method: string,
  path: string,
  url: URL,
  state: SimulationMockState,
): Promise<boolean> {
  if (method === "GET" && path === "/workspaces/1/simulation/sessions") {
    await fulfillJson(route, {
      content: [simulationSession],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/simulation/sessions") {
    expect(route.request().postDataJSON()).toMatchObject({
      customerName: "최시뮬",
    });
    state.messages = [];
    await fulfillJson(route, simulationDetail(state.messages));
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/simulation/sessions/8801") {
    await fulfillJson(route, simulationDetail(state.messages));
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/simulation/sessions/8801/messages") {
    expect(route.request().postDataJSON()).toEqual({
      content: "환불 가능한가요?",
    });
    state.messages = chatMessages;
    await fulfillJson(route, simulationDetail(state.messages));
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/simulation/sessions/8801/feedback") {
    expect(route.request().postDataJSON()).toMatchObject({
      chatMessageId: 702,
      feedbackType: "MISSING_SLOT_QUESTION",
      description: "분류가 흔들립니다.",
      expectedBehavior: "환불 문의로 고정해야 합니다.",
      severity: "HIGH",
    });
    await fulfillJson(route, simulationDetail(state.messages));
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/simulation/golden-cases") {
    await fulfillJson(route, goldenCasePage(state.goldenCases));
    return true;
  }

  if (method === "POST" && path === "/workspaces/1/simulation/sessions/8801/golden-cases") {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body).toEqual({
      name: "환불 주문번호 검증",
      expectedIntentCode: "INT_REFUND",
      expectedWorkflowCode: "WF_REFUND",
      expectedCurrentState: "환불 조건 확인",
      expectedActionType: "ASK_SLOT",
      expectedSlotValues: { orderId: "ORD-20260604" },
    });
    const created: SimulationGoldenCaseMock = {
      id: SIMULATION_GOLDEN_CASE_ID,
      workspaceId: WORKSPACE_ID,
      sourceSessionId: SIMULATION_SESSION_ID,
      sourceDomainPackVersionId: VERSION_ID,
      name: String(body.name),
      inputMessagesJson: JSON.stringify(
        state.messages
          .filter((message) => message.senderRole === "USER" || message.senderRole === "CUSTOMER")
          .map((message) => ({ content: message.content })),
      ),
      expectedJson: JSON.stringify({
        intentCode: body.expectedIntentCode,
        workflowCode: body.expectedWorkflowCode,
        currentState: body.expectedCurrentState,
        actionType: body.expectedActionType,
        slotValues: body.expectedSlotValues,
      }),
      createdBy: 7,
      createdAt: now,
      updatedAt: now,
      latestReplayResult: null,
    };
    state.goldenCases = [created];
    await fulfillJson(route, created);
    return true;
  }

  if (
    method === "POST" &&
    path === `/workspaces/1/simulation/golden-cases/${SIMULATION_GOLDEN_CASE_ID}/replays`
  ) {
    expect(route.request().postDataJSON()).toEqual({ domainPackVersionId: 2 });
    const result = {
      ...simulationReplayResult,
      expectedJson: state.goldenCases[0]?.expectedJson ?? simulationReplayResult.expectedJson,
    };
    state.goldenCases = state.goldenCases.map((goldenCase) =>
      goldenCase.id === SIMULATION_GOLDEN_CASE_ID
        ? { ...goldenCase, latestReplayResult: result }
        : goldenCase,
    );
    await fulfillJson(route, result);
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/simulation/feedback") {
    await fulfillJson(route, {
      content: [simulationFeedback],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    return true;
  }

  if (
    method === "POST" &&
    path === "/workspaces/1/simulation/improvement-candidates/from-feedback/9901"
  ) {
    upsertSimulationCandidate(state, draftImprovementCandidate);
    await fulfillJson(route, draftImprovementCandidate);
    return true;
  }

  if (method === "GET" && path === "/workspaces/1/simulation/improvement-candidates") {
    const status = url.searchParams.get("status") as SimulationCandidateStatus | null;
    const candidates = status
      ? state.candidates.filter((candidate) => candidate.status === status)
      : state.candidates;
    await fulfillJson(route, {
      content: candidates,
      page: 0,
      size: 20,
      totalElements: candidates.length,
      totalPages: candidates.length === 0 ? 0 : 1,
    });
    return true;
  }

  const statusMatch = path.match(
    /^\/workspaces\/1\/simulation\/improvement-candidates\/(\d+)\/status$/,
  );
  if (method === "PATCH" && statusMatch) {
    const candidateId = Number(statusMatch[1]);
    const body = route.request().postDataJSON() as { status?: SimulationCandidateStatus };
    expect(body.status).toBe("READY_FOR_REVIEW");
    const updated = updateSimulationCandidate(state, candidateId, {
      status: body.status,
      updatedAt: now,
    });
    await fulfillJson(route, updated);
    return true;
  }

  const approveMatch = path.match(
    /^\/workspaces\/1\/simulation\/improvement-candidates\/(\d+)\/approve$/,
  );
  if (method === "POST" && approveMatch) {
    const candidateId = Number(approveMatch[1]);
    const body = route.request().postDataJSON() as { reason?: string };
    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    const updated = updateSimulationCandidate(state, candidateId, {
      status: "APPLIED",
      appliedDomainPackVersionId: 2,
      decisionReason: body.reason ?? null,
      decidedBy: 7,
      decidedAt: now,
      updatedAt: now,
    });
    await fulfillJson(route, updated);
    return true;
  }

  const rejectMatch = path.match(
    /^\/workspaces\/1\/simulation\/improvement-candidates\/(\d+)\/reject$/,
  );
  if (method === "POST" && rejectMatch) {
    const candidateId = Number(rejectMatch[1]);
    const body = route.request().postDataJSON() as { reason?: string };
    expect(body.reason).toBeTruthy();
    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });
    const updated = updateSimulationCandidate(state, candidateId, {
      status: "REJECTED",
      decisionReason: body.reason ?? null,
      decidedBy: 7,
      decidedAt: now,
      updatedAt: now,
    });
    await fulfillJson(route, updated);
    return true;
  }

  return false;
}

export async function installAppApiMocks(
  page: Page,
  seen: string[],
  options: AppApiMockOptions = {},
) {
  const domainPackState: DomainPackMockState = {
    currentVersionId: VERSION_ID,
    currentVersionNo: 1,
    draftApproval: options.domainPackDraftApproval ?? "blocked",
    draftLifecycleStatus: "DRAFT",
    draftDescription: "고액 환불 검토 흐름을 정리한 수정 검토본",
  };
  const pipelineReviewState: PipelineReviewMockState = {
    pipelineReviewStatusRequests: {},
    domainPackGenerationFailuresRemaining:
      options.domainPackGenerationFailureAttempts ?? 0,
  };
  const simulationState = createSimulationState();
  const billingState = createBillingMockState();

  await page.route("**/e2e-upload/**", async (route) => {
    seen.push(`${route.request().method()} /e2e-upload/raw-log.zip`);
    await route.fulfill({ status: 200, body: "" });
  });

  await installTrackedApiRoute(page, seen, async (route, method, path, url) => {
    if (await fulfillWorkspaceShell(route, method, path)) return true;
    if (await fulfillDomainPackRead(route, method, path, domainPackState)) return true;
    if (await fulfillBilling(route, method, path, billingState)) return true;
    if (await fulfillWorkspaceOperations(route, method, path, url, options)) return true;
    if (await fulfillUploadAndReview(route, method, path, options, pipelineReviewState))
      return true;
    if (await fulfillSimulation(route, method, path, url, simulationState)) return true;
    return false;
  });
}

const adminCustomerSummary = {
  workspace: {
    id: WORKSPACE_ID,
    workspaceKey: "qa-workspace",
    name: "QA Workspace",
    description: "운영 검증용 고객사",
    status: "ACTIVE",
    createdAt: "2026-05-01T00:00:00+09:00",
    updatedAt: now,
  },
  memberCount: 2,
  billing: {
    subscriptionStatus: "ACTIVE",
    planName: "PRO",
    currentPeriodEnd: "2026-07-01T00:00:00+09:00",
    updatedAt: now,
  },
  latestUpload: {
    datasetId: DATASET_ID,
    datasetKey: "dataset-refund-log",
    name: "refund-log.zip",
    status: "READY",
    uploadedAt: "2026-06-04T09:00:00+09:00",
  },
  latestPipelineJob: {
    id: PIPELINE_JOB_ID,
    jobType: "DOMAIN_PACK_GENERATION",
    status: "WAITING_DOMAIN_CONFIRMATION",
    requestedAt: now,
    startedAt: now,
    finishedAt: null,
  },
};

const adminPipelineJob = {
  pipelineJobId: 8001,
  workspaceId: WORKSPACE_ID,
  datasetId: DATASET_ID,
  domainPackId: PACK_ID,
  jobType: "DOMAIN_PACK_GENERATION",
  status: "FAILED",
  airflowDagId: "domain_pack_generation",
  airflowRunId: "pipeline_job_8001",
  requestedAt: now,
  startedAt: now,
  finishedAt: now,
  queueLagSeconds: 32,
  runningDurationSeconds: 410,
  totalDurationSeconds: 442,
  lagExceeded: false,
  lastErrorMessage: "draft generation timeout",
  retriedFromPipelineJobId: null,
  retryPipelineJobId: null,
};

export async function installAdminApiMocks(page: Page, seen: string[]) {
  await installTrackedApiRoute(page, seen, async (route, method, path) => {
    if (method === "GET" && path === "/admin/customers") {
      await fulfillJson(route, {
        content: [adminCustomerSummary],
        page: 0,
        size: 20,
        hasNext: false,
      });
      return true;
    }

    if (method === "GET" && path === "/admin/customers/1") {
      await fulfillJson(route, {
        workspace: adminCustomerSummary.workspace,
        members: {
          totalCount: 2,
          ownerCount: 1,
          adminCount: 0,
          reviewerCount: 1,
          operatorCount: 1,
          recentMembers: members,
        },
        billing: adminCustomerSummary.billing,
        latestUpload: adminCustomerSummary.latestUpload,
        pipeline: {
          totalCount: 3,
          runningCount: 0,
          succeededCount: 2,
          failedCount: 1,
          latestJob: adminCustomerSummary.latestPipelineJob,
          recentJobs: [adminCustomerSummary.latestPipelineJob],
        },
      });
      return true;
    }

    if (method === "GET" && path === "/admin/billing/customers") {
      await fulfillJson(route, [
        {
          workspaceId: WORKSPACE_ID,
          workspaceKey: "qa-workspace",
          workspaceName: "QA Workspace",
          subscription: {
            status: "ACTIVE",
            currentPeriodStart: "2026-06-01T00:00:00+09:00",
            currentPeriodEnd: "2026-07-01T00:00:00+09:00",
            nextBillingAt: "2026-07-01T00:00:00+09:00",
            planName: "PRO",
            planAmount: 99000,
          },
          recentPayment: {
            id: payment.id,
            amount: payment.amount,
            status: "DONE",
            approvedAt: payment.approvedAt,
          },
          failedStatus: null,
        },
      ]);
      return true;
    }

    if (method === "POST" && path === "/admin/billing/payments/7001/refunds") {
      expect(route.request().postDataJSON()).toEqual({
        reason: "관리자 검증 환불",
      });
      await fulfillJson(route, {
        paymentId: payment.id,
        workspaceId: WORKSPACE_ID,
        refundAmount: payment.amount,
        paymentStatus: "CANCELED",
        transactionKey: "tx-refund-7001",
        canceledAt: now,
        reason: "관리자 검증 환불",
      });
      return true;
    }

    if (method === "GET" && path === "/admin/pipeline-jobs") {
      await fulfillJson(route, {
        data: {
          items: [adminPipelineJob],
          page: 0,
          size: 20,
          totalElements: 1,
          totalPages: 1,
        },
        status: 200,
      });
      return true;
    }

    if (method === "POST" && path === "/admin/pipeline-jobs/8001/retry") {
      await fulfillJson(route, {
        data: {
          sourcePipelineJobId: 8001,
          retryPipelineJobId: 8002,
          workspaceId: WORKSPACE_ID,
          datasetId: DATASET_ID,
          jobType: "DOMAIN_PACK_GENERATION",
          status: "QUEUED",
          airflowDagId: "domain_pack_generation",
          airflowRunId: "pipeline_job_8002",
          requestedAt: now,
          startedAt: null,
        },
        status: 200,
      });
      return true;
    }

    if (method === "POST" && path === "/admin/super-admins") {
      expect(route.request().postDataJSON()).toEqual({
        name: "운영 관리자",
        email: "super-admin@example.com",
        password: "password123",
      });
      await fulfillJson(route, {
        data: {
          id: 91,
          name: "운영 관리자",
          email: "super-admin@example.com",
          role: "SUPER_ADMIN",
        },
        status: 200,
      });
      return true;
    }

    return false;
  });
}

export async function captureScreen(page: Page, testInfo: TestInfo, name: string) {
  const dir = join(testInfo.config.rootDir, "test-results", "e2e-screens");
  mkdirSync(dir, { recursive: true });
  const filename = `${name.replace(/[^a-z0-9가-힣_-]+/gi, "-")}.png`;
  const path = join(dir, filename);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: "image/png" });
  return path;
}
