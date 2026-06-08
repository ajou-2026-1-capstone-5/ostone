import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { WorkspaceSimulationPage } from "./WorkspaceSimulationPage";
import {
  simulationApi,
  type SimulationFeedbackType,
  type SimulationImprovementCandidate,
} from "@/features/simulation";
import { useListAllWorkspaceWorkflows } from "@/entities/workflow";
import { useListIntents } from "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller";

const setCrumbs = vi.fn();
const { toast } = vi.hoisted(() => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useOutletContext: () => ({
      setCrumbs,
      workspace: { id: 1, name: "CS Team" },
    }),
  };
});

vi.mock("@/entities/workflow", () => ({
  useListAllWorkspaceWorkflows: vi.fn(),
}));

vi.mock(
  "@/shared/api/generated/endpoints/intent-definition-controller/intent-definition-controller",
  () => ({
    useListIntents: vi.fn(),
  }),
);

vi.mock("@/features/simulation", () => ({
  simulationApi: {
    listSessions: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    sendMessage: vi.fn(),
    createFeedback: vi.fn(),
    listFeedback: vi.fn(),
    createImprovementCandidate: vi.fn(),
    listImprovementCandidates: vi.fn(),
    updateImprovementCandidateStatus: vi.fn(),
    approveImprovementCandidate: vi.fn(),
    rejectImprovementCandidate: vi.fn(),
    listGoldenCases: vi.fn(),
    createGoldenCase: vi.fn(),
    replayGoldenCase: vi.fn(),
    listGoldenCaseReplays: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast,
}));

const mockedWorkflows = vi.mocked(useListAllWorkspaceWorkflows);
const mockedSimulationApi = vi.mocked(simulationApi);
const mockedIntents = vi.mocked(useListIntents);

function intentsResult(
  data: Array<{ id: number; intentCode: string; name: string }>,
): ReturnType<typeof useListIntents> {
  return { data, isLoading: false, isError: false, error: null } as unknown as ReturnType<
    typeof useListIntents
  >;
}

const session = {
  id: 10,
  channel: "SIMULATION",
  status: "OPEN",
  metaJson: JSON.stringify({ customerName: "테스트 고객" }),
  startedAt: "2026-06-04T10:30:00Z",
};

const otherSession = {
  id: 20,
  channel: "SIMULATION",
  status: "OPEN",
  metaJson: JSON.stringify({ customerName: "다른 고객" }),
  startedAt: "2026-06-04T11:30:00Z",
};

const detail = {
  session,
  messages: [
    {
      id: 1,
      seqNo: 1,
      senderRole: "USER",
      messageType: "TEXT",
      content: "환불하고 싶어요",
      createdAt: "2026-06-04T10:31:00Z",
    },
  ],
  matchedWorkflow: {
    sessionId: 10,
    workspaceId: 1,
    domainPackId: 11,
    domainPackVersionId: 101,
    executionId: 77,
    intentName: "환불 문의",
    intentCode: "refund_request",
    workflowDefinitionId: 100,
    workflowCode: "refund_workflow",
    workflowName: "환불 처리",
    currentState: "collect_order_no",
    executionStatus: "ACTIVE",
  },
  slotValues: { orderNo: "A-100" },
  slots: [],
  feedback: {
    items: [
      {
        id: 900,
        workspaceId: 1,
        sessionId: 10,
        chatMessageId: 1,
        feedbackType: "MISSING_SLOT_QUESTION",
        description: "주문번호를 묻지 않았습니다.",
        expectedBehavior: "주문번호를 먼저 요청합니다.",
        severity: "HIGH",
        status: "OPEN",
        createdBy: 7,
        createdAt: "2026-06-04T10:40:00Z",
        updatedAt: "2026-06-04T10:40:00Z",
      },
    ],
    messageFeedbackCounts: { "1": 1 },
  },
};

const candidate = {
  id: 1000,
  workspaceId: 1,
  domainPackVersionId: 101,
  feedbackId: 900,
  sessionId: 10,
  chatMessageId: 1,
  candidateType: "SLOT_QUESTION",
  targetElementType: "SLOT",
  targetElementId: null,
  targetElementKey: null,
  beforeSummary: "주문번호를 묻지 않았습니다.",
  afterSummary: "주문번호를 먼저 요청합니다.",
  evidenceSummary: "simulation feedback #900",
  reviewSessionId: null,
  reviewTaskId: null,
  appliedDomainPackVersionId: null,
  draftPatchJson: "{}",
  decisionReason: null,
  decidedBy: null,
  decidedAt: null,
  status: "DRAFT",
  createdBy: 7,
  createdAt: "2026-06-04T10:45:00Z",
  updatedAt: "2026-06-04T10:45:00Z",
} as const;

const validDraftPatchJson = JSON.stringify({
  schemaVersion: "simulation-candidate-draft-patch.v1",
  operation: "UPDATE_DESCRIPTION",
  targetElementType: "SLOT",
  targetElementId: 55,
  targetElementKey: "orderNo",
  beforeSummary: "주문번호를 묻지 않았습니다.",
  afterSummary: "주문번호를 먼저 요청합니다.",
  evidenceSummary: "simulation feedback #900 (session #10, turn #1)",
});

const arrayDraftPatchJson = JSON.stringify({
  changes: [
    null,
    { field: "빈 변경" },
    {
      beforeValue: { required: false },
      afterValue: true,
    },
  ],
});

const goldenCase = {
  id: 950,
  workspaceId: 1,
  sourceSessionId: 10,
  sourceDomainPackVersionId: 101,
  name: "환불 검증",
  inputMessagesJson: '[{"content":"환불하고 싶어요"}]',
  expectedJson:
    '{"intentCode":"refund_request","workflowCode":"refund_workflow","currentState":"collect_order_no","actionType":"ASK_SLOT"}',
  createdBy: 7,
  createdAt: "2026-06-05T10:45:00Z",
  updatedAt: "2026-06-05T10:45:00Z",
  latestReplayResult: null,
} as const;

const replayResult = {
  id: 990,
  workspaceId: 1,
  goldenCaseId: 950,
  domainPackVersionId: 101,
  replaySessionId: 960,
  status: "PASS",
  expectedJson: "{}",
  actualJson: "{}",
  failureSummary: null,
  createdBy: 7,
  createdAt: "2026-06-05T10:46:00Z",
} as const;

const failedReplayResult = {
  ...replayResult,
  id: 991,
  status: "FAIL",
  failureSummary: "currentState expected collect_order_no but was handoff",
} as const;

function candidateWithType(
  id: number,
  candidateType: SimulationImprovementCandidate["candidateType"],
): SimulationImprovementCandidate {
  return {
    ...candidate,
    id,
    candidateType,
  };
}

function feedbackWithType(id: number, feedbackType: SimulationFeedbackType) {
  return {
    ...detail.feedback.items[0],
    id,
    feedbackType,
  };
}

const otherDetail = {
  ...detail,
  session: otherSession,
  messages: [
    {
      id: 3,
      seqNo: 1,
      senderRole: "USER",
      messageType: "TEXT",
      content: "배송지를 바꾸고 싶어요",
      createdAt: "2026-06-04T11:31:00Z",
    },
  ],
  feedback: {
    items: [],
    messageFeedbackCounts: {},
  },
};

function renderPage(path = "/workspaces/1/simulation", state?: unknown) {
  render(
    <MemoryRouter
      initialEntries={[state === undefined ? path : { pathname: path, state }]}
    >
      <Routes>
        <Route
          path="/workspaces/:workspaceId/simulation"
          element={<WorkspaceSimulationPage />}
        />
        <Route
          path="/workspaces"
          element={<div data-testid="workspace-root" />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

async function openFeedbackTab() {
  fireEvent.click(await screen.findByRole("tab", { name: "피드백" }));
}

async function openCandidateTab() {
  fireEvent.click(await screen.findByRole("tab", { name: "개선 후보" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedWorkflows.mockReturnValue({
    loading: false,
    error: null,
    entries: [
      {
        packId: 11,
        packName: "CS Support",
        versionId: 22,
        workflowId: 100,
        workflowCode: "refund.standard",
        name: "환불 처리",
        description: null,
        intentDefinitionId: 30,
      },
    ],
  });
  mockedIntents.mockReturnValue(
    intentsResult([
      { id: 301, intentCode: "refund_request", name: "환불 요청" },
      { id: 302, intentCode: "travel_recommend", name: "여행 추천" },
    ]),
  );
  mockedSimulationApi.listSessions.mockResolvedValue({
    content: [session],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  mockedSimulationApi.getSession.mockImplementation(
    async (_workspaceId, sessionId) =>
      sessionId === otherSession.id ? otherDetail : detail,
  );
  mockedSimulationApi.createSession.mockResolvedValue(detail);
  mockedSimulationApi.createFeedback.mockResolvedValue(detail);
  mockedSimulationApi.listFeedback.mockResolvedValue({
    content: detail.feedback.items,
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
  mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  mockedSimulationApi.createImprovementCandidate.mockResolvedValue(candidate);
  mockedSimulationApi.updateImprovementCandidateStatus.mockResolvedValue({
    ...candidate,
    status: "READY_FOR_REVIEW",
  });
  mockedSimulationApi.approveImprovementCandidate.mockResolvedValue({
    ...candidate,
    status: "APPLIED",
    appliedDomainPackVersionId: 102,
    decisionReason: "시뮬레이션 리뷰 승인",
  });
  mockedSimulationApi.rejectImprovementCandidate.mockResolvedValue({
    ...candidate,
    status: "REJECTED",
    decisionReason: "근거가 부족합니다.",
  });
  mockedSimulationApi.listGoldenCases.mockResolvedValue({
    content: [],
    page: 0,
    size: 20,
    totalElements: 0,
    totalPages: 0,
  });
  mockedSimulationApi.createGoldenCase.mockResolvedValue(goldenCase);
  mockedSimulationApi.replayGoldenCase.mockResolvedValue(replayResult);
  mockedSimulationApi.sendMessage.mockResolvedValue({
    ...detail,
    messages: [
      ...detail.messages,
      {
        id: 2,
        seqNo: 2,
        senderRole: "ASSISTANT",
        messageType: "TEXT",
        content: "주문번호를 알려주세요.",
        createdAt: "2026-06-04T10:32:00Z",
      },
    ],
  });
});

export {
  arrayDraftPatchJson,
  candidate,
  candidateWithType,
  detail,
  failedReplayResult,
  feedbackWithType,
  goldenCase,
  intentsResult,
  mockedIntents,
  mockedSimulationApi,
  mockedWorkflows,
  openCandidateTab,
  openFeedbackTab,
  otherSession,
  renderPage,
  replayResult,
  session,
  toast,
  validDraftPatchJson,
};
