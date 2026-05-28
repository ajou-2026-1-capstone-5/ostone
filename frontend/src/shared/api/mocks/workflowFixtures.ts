interface MockIntent {
  id: number;
  intentCode: string;
  name: string;
  description: string;
  taxonomyLevel: number;
  parentIntentId: number | null;
  status: string;
}

interface MockWorkflow {
  id: number;
  workflowCode: string;
  name: string;
  description: string;
  intentDefinitionId: number;
  graphJson: unknown;
}

const NOW = "2026-05-25T09:00:00Z";

const INTENT_REFUND_REQUEST: MockIntent = {
  id: 9001,
  intentCode: "refund.request",
  name: "환불 요청",
  description: "주문 환불을 요청하는 인텐트",
  taxonomyLevel: 2,
  parentIntentId: null,
  status: "DRAFT",
};

const INTENT_DELIVERY_INQUIRY: MockIntent = {
  id: 9002,
  intentCode: "delivery.inquiry",
  name: "배송 조회",
  description: "배송 상태 확인 인텐트",
  taxonomyLevel: 2,
  parentIntentId: null,
  status: "DRAFT",
};

const INTENT_PAYMENT_ISSUE: MockIntent = {
  id: 9003,
  intentCode: "payment.issue",
  name: "결제 문제",
  description: "결제 실패/이중결제 처리",
  taxonomyLevel: 2,
  parentIntentId: null,
  status: "DRAFT",
};

const INTENT_NO_WORKFLOW: MockIntent = {
  id: 9004,
  intentCode: "vague.question",
  name: "분류 모호",
  description: "워크플로우가 아직 매핑되지 않은 인텐트",
  taxonomyLevel: 3,
  parentIntentId: null,
  status: "DRAFT",
};

const INTENT_LARGE: MockIntent = {
  id: 9005,
  intentCode: "complex.flow",
  name: "복합 케이스",
  description: "위상정렬 + 사이클 + 라벨이 풍부한 케이스",
  taxonomyLevel: 2,
  parentIntentId: null,
  status: "DRAFT",
};

const MOCK_INTENTS: MockIntent[] = [
  INTENT_REFUND_REQUEST,
  INTENT_DELIVERY_INQUIRY,
  INTENT_PAYMENT_ISSUE,
  INTENT_NO_WORKFLOW,
  INTENT_LARGE,
];

const REFUND_WORKFLOWS: MockWorkflow[] = [
  {
    id: 7001,
    workflowCode: "wf.refund.standard",
    name: "표준 환불 처리",
    description: "주문 조회 → 자격 판단 → 환불 실행 → 안내",
    intentDefinitionId: INTENT_REFUND_REQUEST.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작", position: { x: 0, y: 0 } },
        { id: "lookup", type: "ACTION", label: "주문 조회", position: { x: 110, y: 0 } },
        { id: "decide", type: "DECISION", label: "환불 자격?", position: { x: 220, y: 0 } },
        { id: "do_refund", type: "ACTION", label: "환불 실행", position: { x: 330, y: -40 } },
        { id: "deny", type: "ANSWER", label: "환불 불가 안내", position: { x: 330, y: 40 } },
        { id: "notify", type: "ANSWER", label: "환불 완료 안내", position: { x: 440, y: -40 } },
        { id: "end", type: "TERMINAL", label: "종료", position: { x: 550, y: 0 } },
      ],
      edges: [
        { from: "start", to: "lookup" },
        { from: "lookup", to: "decide" },
        { from: "decide", to: "do_refund", label: "가능" },
        { from: "decide", to: "deny", label: "불가" },
        { from: "do_refund", to: "notify" },
        { from: "notify", to: "end" },
        { from: "deny", to: "end" },
      ],
    },
  },
  {
    id: 7002,
    workflowCode: "wf.refund.partial",
    name: "부분 환불 처리",
    description: "수령 확인 후 부분 환불 적용",
    intentDefinitionId: INTENT_REFUND_REQUEST.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작" },
        { id: "verify", type: "ACTION", label: "수령 확인" },
        { id: "calc", type: "ACTION", label: "환불액 산정" },
        { id: "handoff", type: "HANDOFF", label: "상담사 이관" },
        { id: "end", type: "TERMINAL", label: "종료" },
      ],
      edges: [
        { from: "start", to: "verify" },
        { from: "verify", to: "calc" },
        { from: "calc", to: "handoff", label: "확인 필요" },
        { from: "handoff", to: "end" },
      ],
    },
  },
];

const DELIVERY_WORKFLOWS: MockWorkflow[] = [
  {
    id: 7101,
    workflowCode: "wf.delivery.tracking",
    name: "배송 추적 안내",
    description: "운송장 조회 → 상태 안내",
    intentDefinitionId: INTENT_DELIVERY_INQUIRY.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작" },
        { id: "fetch", type: "ACTION", label: "운송장 조회" },
        { id: "status", type: "DECISION", label: "배송 상태?" },
        { id: "msg_normal", type: "ANSWER", label: "예상 배송일 안내" },
        { id: "msg_delay", type: "ANSWER", label: "지연 사유 안내" },
        { id: "end", type: "TERMINAL", label: "종료" },
      ],
      edges: [
        { from: "start", to: "fetch" },
        { from: "fetch", to: "status" },
        { from: "status", to: "msg_normal", label: "정상" },
        { from: "status", to: "msg_delay", label: "지연" },
        { from: "msg_normal", to: "end" },
        { from: "msg_delay", to: "end" },
      ],
    },
  },
];

const PAYMENT_WORKFLOWS: MockWorkflow[] = [
  {
    id: 7201,
    workflowCode: "wf.payment.dispute",
    name: "결제 이의 처리",
    description: "결제 내역 검증 → PG사 문의 → 안내",
    intentDefinitionId: INTENT_PAYMENT_ISSUE.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작" },
        { id: "verify", type: "ACTION", label: "결제 검증" },
        { id: "duplicate", type: "DECISION", label: "이중결제?" },
        { id: "refund", type: "ACTION", label: "자동 환불" },
        { id: "pg", type: "HANDOFF", label: "PG사 문의" },
        { id: "answer", type: "ANSWER", label: "처리 결과 안내" },
        { id: "end", type: "TERMINAL", label: "종료" },
      ],
      edges: [
        { from: "start", to: "verify" },
        { from: "verify", to: "duplicate" },
        { from: "duplicate", to: "refund", label: "예" },
        { from: "duplicate", to: "pg", label: "아니오" },
        { from: "refund", to: "answer" },
        { from: "pg", to: "answer" },
        { from: "answer", to: "end" },
      ],
    },
  },
  {
    id: 7202,
    workflowCode: "wf.payment.method-update",
    name: "결제수단 변경",
    description: "위치 정보 없이 자동 레이아웃 검증용",
    intentDefinitionId: INTENT_PAYMENT_ISSUE.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작" },
        { id: "check", type: "ACTION", label: "기존 수단 확인" },
        { id: "input", type: "ACTION", label: "신규 수단 입력" },
        { id: "ok", type: "ANSWER", label: "변경 완료" },
        { id: "end", type: "TERMINAL", label: "종료" },
      ],
      edges: [
        { from: "start", to: "check" },
        { from: "check", to: "input" },
        { from: "input", to: "ok", label: "성공" },
        { from: "ok", to: "end" },
      ],
    },
  },
];

const LARGE_WORKFLOWS: MockWorkflow[] = [
  {
    id: 7301,
    workflowCode: "wf.complex.cyclic",
    name: "사이클 포함 케이스",
    description: "재시도 루프가 포함된 그래프 (사이클 fallback 검증)",
    intentDefinitionId: INTENT_LARGE.id,
    graphJson: {
      direction: "LR",
      nodes: [
        { id: "start", type: "START", label: "시작" },
        { id: "check", type: "DECISION", label: "조건 충족?" },
        { id: "retry", type: "ACTION", label: "재시도" },
        { id: "ok", type: "ANSWER", label: "완료 안내" },
        { id: "fail", type: "ANSWER", label: "실패 안내" },
        { id: "end", type: "TERMINAL", label: "종료" },
      ],
      edges: [
        { from: "start", to: "check" },
        { from: "check", to: "ok", label: "예" },
        { from: "check", to: "retry", label: "아니오" },
        { from: "retry", to: "check", label: "재시도" },
        { from: "ok", to: "end" },
        { from: "fail", to: "end" },
      ],
    },
  },
];

const ALL_WORKFLOWS: MockWorkflow[] = [
  ...REFUND_WORKFLOWS,
  ...DELIVERY_WORKFLOWS,
  ...PAYMENT_WORKFLOWS,
  ...LARGE_WORKFLOWS,
];

const MOCK_WORKSPACE_ID = 1;
const MOCK_PACK_ID = 1;
const MOCK_VERSION_ID = 1;

const MOCK_WORKSPACES = [
  { id: MOCK_WORKSPACE_ID, name: "Demo Workspace", description: "mock-only workspace" },
];

const MOCK_PACK = {
  packId: MOCK_PACK_ID,
  name: "Demo Pack",
  description: "mock-only pack",
  versions: [
    {
      versionId: MOCK_VERSION_ID,
      versionNo: 1,
      lifecycleStatus: "DRAFT",
      summaryJson: "{}",
    },
  ],
};

const MOCK_PACK_SUMMARY = [
  { packId: MOCK_PACK_ID, name: MOCK_PACK.name, description: MOCK_PACK.description },
];

const MOCK_VERSION_DETAIL = {
  versionId: MOCK_VERSION_ID,
  packId: MOCK_PACK_ID,
  versionNo: 1,
  lifecycleStatus: "DRAFT",
  summaryJson: "{}",
  createdAt: NOW,
  updatedAt: NOW,
};

function workflowSummary(wf: MockWorkflow) {
  return {
    id: wf.id,
    domainPackVersionId: MOCK_VERSION_ID,
    intentDefinitionId: wf.intentDefinitionId,
    workflowCode: wf.workflowCode,
    name: wf.name,
    description: wf.description,
    initialState: "start",
    terminalStatesJson: '["end"]',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function workflowDetail(wf: MockWorkflow) {
  return {
    id: wf.id,
    workflowCode: wf.workflowCode,
    name: wf.name,
    description: wf.description,
    graphJson: wf.graphJson,
    initialState: "start",
    terminalStatesJson: '["end"]',
    evidenceJson: "[]",
    metaJson: "{}",
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function intentSummary(intent: MockIntent) {
  return {
    id: intent.id,
    intentCode: intent.intentCode,
    name: intent.name,
    description: intent.description,
    taxonomyLevel: intent.taxonomyLevel,
    parentIntentId: intent.parentIntentId,
    status: intent.status,
    sourceClusterRef: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function intentDetail(intent: MockIntent) {
  return {
    ...intentSummary(intent),
    entryConditionJson: "{}",
    evidenceJson: "[]",
    metaJson: "{}",
  };
}

const LIST_INTENTS_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}/versions/${MOCK_VERSION_ID}/intents$`,
);

const INTENT_DETAIL_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}/versions/${MOCK_VERSION_ID}/intents/(\\d+)$`,
);

const LIST_WORKFLOWS_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}/versions/${MOCK_VERSION_ID}/workflows(\\?.*)?$`,
);

const WORKFLOW_DETAIL_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}/versions/${MOCK_VERSION_ID}/workflows/(\\d+)$`,
);

function parseIntentIdFromQuery(query: string | undefined): number | null {
  if (!query) return null;
  const trimmed = query.startsWith("?") ? query.slice(1) : query;
  const params = new URLSearchParams(trimmed);
  const raw = params.get("intentDefinitionId");
  if (!raw) return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

const PACK_DETAIL_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}$`,
);

const VERSION_DETAIL_RE = new RegExp(
  `^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs/${MOCK_PACK_ID}/versions/${MOCK_VERSION_ID}$`,
);

const LIST_PACKS_RE = new RegExp(`^/workspaces/${MOCK_WORKSPACE_ID}/domain-packs$`);

const LIST_WORKSPACES_RE = /^\/workspaces(\?.*)?$/;

export function tryMockResponse<T>(path: string, method: string): T | null {
  if (method !== "GET") return null;

  if (LIST_WORKSPACES_RE.test(path)) {
    return MOCK_WORKSPACES as unknown as T;
  }

  if (LIST_PACKS_RE.test(path)) {
    return MOCK_PACK_SUMMARY as unknown as T;
  }

  if (PACK_DETAIL_RE.test(path)) {
    return MOCK_PACK as unknown as T;
  }

  if (VERSION_DETAIL_RE.test(path)) {
    return MOCK_VERSION_DETAIL as unknown as T;
  }

  if (LIST_INTENTS_RE.test(path)) {
    return MOCK_INTENTS.map(intentSummary) as unknown as T;
  }

  const intentDetailMatch = INTENT_DETAIL_RE.exec(path);
  if (intentDetailMatch) {
    const intentId = Number(intentDetailMatch[1]);
    const intent = MOCK_INTENTS.find((i) => i.id === intentId);
    return intent ? (intentDetail(intent) as unknown as T) : null;
  }

  const workflowDetailMatch = WORKFLOW_DETAIL_RE.exec(path);
  if (workflowDetailMatch) {
    const workflowId = Number(workflowDetailMatch[1]);
    const wf = ALL_WORKFLOWS.find((w) => w.id === workflowId);
    return wf ? (workflowDetail(wf) as unknown as T) : null;
  }

  const listMatch = LIST_WORKFLOWS_RE.exec(path);
  if (listMatch) {
    const intentId = parseIntentIdFromQuery(listMatch[1]);
    const filtered =
      intentId === null
        ? ALL_WORKFLOWS
        : ALL_WORKFLOWS.filter((w) => w.intentDefinitionId === intentId);
    return filtered.map(workflowSummary) as unknown as T;
  }

  return null;
}

export const MOCK_FIXTURE_META = {
  workspaceId: MOCK_WORKSPACE_ID,
  packId: MOCK_PACK_ID,
  versionId: MOCK_VERSION_ID,
  intents: MOCK_INTENTS,
  workflows: ALL_WORKFLOWS,
};
