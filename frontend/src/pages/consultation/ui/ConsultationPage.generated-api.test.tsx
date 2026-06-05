import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsultationPage } from "./ConsultationPage";

const mocks = vi.hoisted(() => ({
  customFetch: vi.fn(),
  getMessages: vi.fn(),
  sendMessage: vi.fn(),
  updateStatus: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  sendTo: vi.fn(),
  shellContext: {
    setTopbarRight: vi.fn(),
    setCrumbs: vi.fn(),
    workspace: { id: 2, name: "QA Alpha" } as { id: number; name: string } | null,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useOutletContext: () => mocks.shellContext,
  };
});

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: () => ({
    connectionStatus: "CONNECTED",
    subscribe: mocks.subscribe,
    sendTo: mocks.sendTo,
    sendMessage: vi.fn(),
    lastMessage: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
  }),
}));

vi.mock("@/shared/api/mutator", () => ({
  customFetch: mocks.customFetch,
}));

vi.mock("@/shared/api/generated/endpoints/consultation-controller/consultation-controller", () => ({
  getGetMessagesUrl: (sessionId: number) => `/api/v1/consultation/sessions/${sessionId}/messages`,
  getMessages: mocks.getMessages,
  sendMessage: mocks.sendMessage,
  updateStatus: mocks.updateStatus,
}));

function saveTestUser(id: number) {
  window.localStorage.setItem(
    "user",
    JSON.stringify({ id, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const findQueueCustomerButton = (customerName: string) =>
  screen.findByRole("button", { name: new RegExp(customerName) });

const assignedSession = {
  id: 1,
  status: "ACTIVE",
  channel: "카카오톡",
  metaJson: JSON.stringify({ customerName: "김민지", handoffReason: "환불 문의" }),
  startedAt: "2026-05-22T00:00:00Z",
  assignedCounselorId: 7,
};

describe("ConsultationPage generated API integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    saveTestUser(7);
    mocks.shellContext.workspace = { id: 2, name: "QA Alpha" };
    mocks.customFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/workspaces/2/consultation/metrics") {
        return Promise.resolve({
          data: {
            workspaceId: 2,
            periodStart: "2026-05-22T00:00:00Z",
            periodEnd: "2026-05-23T00:00:00Z",
            totalConsultationCount: 6,
            completedConsultationCount: 4,
            averageFirstResponseSeconds: 90,
            averageLlmFirstResponseSeconds: 3,
            averageHumanFirstResponseSeconds: 180,
            llmHandledCount: 2,
            humanInterventionCount: 2,
            unresolvedSessionCount: 1,
            comparison: null,
            handledTodayCount: 4,
            llmHandledTodayCount: 2,
            humanHandledTodayCount: 2,
          },
        });
      }
      if (url === "/api/v1/workspaces/2/consultation/queue") {
        return Promise.resolve({ data: [assignedSession] });
      }
      return Promise.reject(new Error(`Unexpected manual endpoint: ${url}`));
    });
    mocks.getMessages.mockResolvedValue({
      content: [
        {
          id: 100,
          seqNo: 1,
          senderRole: "CUSTOMER",
          messageType: "TEXT",
          content: "generated 상담 메시지",
          createdAt: "2026-05-22T00:01:00Z",
        },
      ],
      page: 0,
      size: 50,
      totalElements: 1,
      totalPages: 1,
    });
    mocks.updateStatus.mockResolvedValue({
      data: {
        ...assignedSession,
        status: "COMPLETED",
      },
    });
  });

  it("상담 화면에서 고객 선택 시 generated 메시지 URL 응답을 렌더링한다", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    fireEvent.click(await findQueueCustomerButton("김민지"));

    expect(await screen.findByText("generated 상담 메시지")).toBeInTheDocument();
    expect(mocks.customFetch).toHaveBeenCalledWith("/api/v1/workspaces/2/consultation/queue", {
      method: "GET",
    });
    expect(mocks.getMessages).toHaveBeenCalledWith(1, { page: 0, size: 50 });
  });

  it(
    "상담 종료 액션은 확인 모달에서 처리 결과를 선택한 뒤 generated updateStatus로 전송한다",
    async () => {
      render(<ConsultationPage />, { wrapper: Wrapper });

      fireEvent.click(await findQueueCustomerButton("김민지"));
      await screen.findByText("generated 상담 메시지");

      fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));
      expect(mocks.updateStatus).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: /후속 연락 필요/ }));
      fireEvent.change(screen.getByLabelText("종료 사유 또는 내부 메모"), {
        target: { value: "배송사 확인 후 연락" },
      });
      fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

      await waitFor(() => {
        expect(mocks.updateStatus).toHaveBeenCalledWith(1, {
          status: "RESOLVED",
          resolutionOutcome: "FOLLOW_UP_REQUIRED",
          resolutionReason: "배송사 확인 후 연락",
          followUpRequired: true,
        });
      });
      await waitFor(() => {
        const metricsCalls = mocks.customFetch.mock.calls.filter(
          ([url]) => url === "/api/v1/workspaces/2/consultation/metrics",
        );
        expect(metricsCalls).toHaveLength(2);
      });
      expect(mocks.toastSuccess).toHaveBeenCalledWith("상담이 종료되었습니다.");
    },
    20_000,
  );
});
