import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatRoom } from "@/features/user-chat/ui/ChatRoom";
import { PolicyDetailPanel } from "@/features/policy-draft-read/ui/PolicyDetailPanel";
import { PolicyListPanel } from "@/features/policy-draft-read/ui/PolicyListPanel";
import { RiskDetailPanel } from "@/features/risk-draft-read/ui/RiskDetailPanel";
import { RiskListPanel } from "@/features/risk-draft-read/ui/RiskListPanel";
import { SlotDetailPanel } from "@/features/slot-draft-read/ui/SlotDetailPanel";
import { SlotListPanel } from "@/features/slot-draft-read/ui/SlotListPanel";
import { WorkflowDetailPanel } from "@/features/workflow-draft-read/ui/WorkflowDetailPanel";
import { WorkflowListPanel } from "@/features/workflow-draft-read/ui/WorkflowListPanel";

const mocks = vi.hoisted(() => ({
  getMessages: vi.fn(),
  toastError: vi.fn(),
  useGetPolicy: vi.fn(),
  useGetRisk: vi.fn(),
  useGetSlot: vi.fn(),
  useGetWorkflow: vi.fn(),
  useListPolicies: vi.fn(),
  useListRisks: vi.fn(),
  useListSlots: vi.fn(),
  useListTransitions: vi.fn(),
  useListWorkflows: vi.fn(),
  stompState: {
    connectionStatus: "CONNECTED" as "CONNECTING" | "CONNECTED" | "DISCONNECTED" | "ERROR",
    sendMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => mocks.stompState,
}));

vi.mock(
  "@/shared/api/generated/endpoints/consultation-controller/consultation-controller",
  () => ({
    getMessages: mocks.getMessages,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/policy-definition-controller/policy-definition-controller",
  () => ({
    useGetPolicy: mocks.useGetPolicy,
    useListPolicies: mocks.useListPolicies,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/risk-definition-controller/risk-definition-controller",
  () => ({
    useGetRisk: mocks.useGetRisk,
    useListRisks: mocks.useListRisks,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/slot-definition-controller/slot-definition-controller",
  () => ({
    useGetSlot: mocks.useGetSlot,
    useListSlots: mocks.useListSlots,
  }),
);

vi.mock(
  "@/shared/api/generated/endpoints/workflow-definition-controller/workflow-definition-controller",
  () => ({
    useGetWorkflow: mocks.useGetWorkflow,
    useListTransitions: mocks.useListTransitions,
    useListWorkflows: mocks.useListWorkflows,
  }),
);

type GeneratedQueryOptions = {
  query?: {
    enabled?: boolean;
    select?: (response: unknown) => unknown;
  };
};

function getOptions(args: unknown[], index: number): GeneratedQueryOptions | undefined {
  return args[index] as GeneratedQueryOptions | undefined;
}

function makeGeneratedQuery(response: unknown, options?: GeneratedQueryOptions) {
  const enabled = options?.query?.enabled ?? true;
  const data = enabled ? (options?.query?.select?.(response) ?? response) : undefined;
  return {
    data,
    isLoading: false,
    isFetching: false,
    isError: false,
    isSuccess: enabled,
    error: null,
    refetch: vi.fn(),
  };
}

const policySummary = {
  id: 41,
  domainPackVersionId: 3,
  policyCode: "POL_REFUND",
  name: "환불 정책",
  severity: "HIGH",
  status: "ACTIVE",
};

const policyDetail = {
  ...policySummary,
  description: "환불 승인 조건",
  conditionJson: '{"channel":"web"}',
  actionJson: '{"type":"REFUND_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const riskSummary = {
  id: 51,
  domainPackVersionId: 3,
  riskCode: "RISK_FRAUD",
  name: "사기 위험",
  riskLevel: "HIGH",
  status: "ACTIVE",
};

const riskDetail = {
  ...riskSummary,
  description: "부정 거래 징후",
  triggerConditionJson: '{"amount":100000}',
  handlingActionJson: '{"type":"MANUAL_REVIEW"}',
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const slotSummary = {
  id: 61,
  domainPackVersionId: 3,
  slotCode: "SLOT_ADDRESS",
  name: "배송 주소",
  dataType: "STRING",
  isSensitive: false,
  status: "ACTIVE",
};

const slotDetail = {
  ...slotSummary,
  description: "배송지 주소",
  validationRuleJson: '{"required":true}',
  defaultValueJson: "{}",
  metaJson: "{}",
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const workflowSummary = {
  id: 71,
  workflowCode: "WF_REFUND",
  name: "환불 처리",
  description: "환불 workflow",
  initialState: "START",
  terminalStatesJson: '["DONE"]',
  createdAt: "2026-05-22T00:00:00Z",
  updatedAt: "2026-05-22T00:00:00Z",
};

const workflowDetail = {
  ...workflowSummary,
  graphJson: null,
  evidenceJson: "{}",
  metaJson: "{}",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.stompState.connectionStatus = "CONNECTED";
  mocks.stompState.subscribe.mockReturnValue(() => {});

  mocks.useListPolicies.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: [policySummary] }, getOptions(args, 3)),
  );
  mocks.useGetPolicy.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: policyDetail }, getOptions(args, 4)),
  );
  mocks.useListRisks.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: [riskSummary] }, getOptions(args, 3)),
  );
  mocks.useGetRisk.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: riskDetail }, getOptions(args, 4)),
  );
  mocks.useListSlots.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: [slotSummary] }, getOptions(args, 3)),
  );
  mocks.useGetSlot.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: slotDetail }, getOptions(args, 4)),
  );
  mocks.useListWorkflows.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: [workflowSummary] }, getOptions(args, 4)),
  );
  mocks.useGetWorkflow.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: workflowDetail }, getOptions(args, 4)),
  );
  mocks.useListTransitions.mockImplementation((...args: unknown[]) =>
    makeGeneratedQuery({ data: [] }, getOptions(args, 4)),
  );
});

describe("generated API affected read screens", () => {
  it("정책 목록 화면은 generated list 응답의 data wrapper를 풀어 렌더링한다", () => {
    const onSelect = vi.fn();

    render(
      <PolicyListPanel
        workspaceId={1}
        packId={2}
        versionId={3}
        selectedId={41}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText("1개")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /POL_REFUND/ })).toHaveTextContent("환불 정책");
    fireEvent.click(screen.getByRole("button", { name: /POL_REFUND/ }));
    expect(onSelect).toHaveBeenCalledWith(41);
    expect(mocks.useListPolicies).toHaveBeenCalledWith(1, 2, 3, expect.any(Object));
  });

  it("정책 상세 화면은 generated detail 응답으로 수정 진입 액션까지 렌더링한다", () => {
    const onEdit = vi.fn();

    render(
      <PolicyDetailPanel
        workspaceId={1}
        packId={2}
        versionId={3}
        policyId={41}
        onEdit={onEdit}
      />,
    );

    expect(screen.getAllByText("POL_REFUND").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("환불 승인 조건")).toBeInTheDocument();
    expect(screen.getByText(/REFUND_REVIEW/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /POL_REFUND 응대 기준 수정/ }));
    expect(onEdit).toHaveBeenCalledWith(41);
    expect(mocks.useGetPolicy).toHaveBeenCalledWith(1, 2, 3, 41, expect.any(Object));
  });

  it("위험요소 목록/상세 화면은 generated 응답을 실제 panel까지 전달한다", () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();

    render(
      <>
        <RiskListPanel
          workspaceId={1}
          packId={2}
          versionId={3}
          selectedId={51}
          onSelect={onSelect}
        />
        <RiskDetailPanel
          workspaceId={1}
          packId={2}
          versionId={3}
          riskId={51}
          onEdit={onEdit}
        />
      </>,
    );

    fireEvent.click(
      within(screen.getByLabelText("주의 사항 목록")).getByRole("button", { name: /RISK_FRAUD/ }),
    );
    expect(onSelect).toHaveBeenCalledWith(51);
    expect(screen.getByText("부정 거래 징후")).toBeInTheDocument();
    expect(screen.getByText(/MANUAL_REVIEW/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /RISK_FRAUD 주의 사항 수정/ }));
    expect(onEdit).toHaveBeenCalledWith(51);
  });

  it("슬롯 목록/상세 화면은 generated 응답을 실제 panel까지 전달한다", () => {
    const onSelect = vi.fn();

    render(
      <>
        <SlotListPanel wsId={1} packId={2} versionId={3} selectedId={61} onSelect={onSelect} />
        <SlotDetailPanel wsId={1} packId={2} versionId={3} slotId={61} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /SLOT_ADDRESS/ }));
    expect(onSelect).toHaveBeenCalledWith(61);
    expect(screen.getAllByText("배송 주소").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("STRING").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("아니오")).toBeInTheDocument();
  });

  it("workflow 목록/상세 화면은 generated list/detail/transition/policy 응답을 함께 소비한다", () => {
    const onSelect = vi.fn();

    render(
      <>
        <WorkflowListPanel wsId={1} packId={2} versionId={3} selectedId={71} onSelect={onSelect} />
        <WorkflowDetailPanel wsId={1} packId={2} versionId={3} workflowId={71} />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: /WF_REFUND/ }));
    expect(onSelect).toHaveBeenCalledWith(71);
    expect(screen.getAllByText("환불 처리").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("흐름도 데이터 없음")).toBeInTheDocument();
    expect(screen.queryByText("응대 기준 목록을 불러오지 못했습니다.")).not.toBeInTheDocument();
    expect(mocks.useListTransitions).toHaveBeenCalledWith(1, 2, 3, 71, expect.any(Object));
  });
});

describe("generated API affected chat screen", () => {
  it("ChatRoom은 generated getMessages 응답을 chatApi 경유로 렌더링한다", async () => {
    mocks.getMessages.mockResolvedValueOnce({
      data: [
        {
          id: 91,
          seqNo: 1,
          senderRole: "ASSISTANT",
          messageType: "TEXT",
          content: "이전 상담 메시지",
          createdAt: "2026-05-22T08:00:00Z",
        },
      ],
    });

    render(<ChatRoom sessionId={7} />);

    expect(await screen.findByText("이전 상담 메시지")).toBeInTheDocument();
    expect(mocks.getMessages).toHaveBeenCalledWith(7);
    await waitFor(() => {
      expect(mocks.stompState.subscribe).toHaveBeenCalledWith("/topic/chat.7", expect.any(Function));
    });
  });
});
