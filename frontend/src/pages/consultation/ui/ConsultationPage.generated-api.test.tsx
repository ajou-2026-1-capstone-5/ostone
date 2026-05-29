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

vi.mock(
  "@/shared/api/generated/endpoints/consultation-controller/consultation-controller",
  () => ({
    getGetMessagesUrl: (sessionId: number) => `/api/v1/consultation/sessions/${sessionId}/messages`,
    getMessages: mocks.getMessages,
    sendMessage: mocks.sendMessage,
    updateStatus: mocks.updateStatus,
  }),
);

function saveTestUser(id: number) {
  window.localStorage.setItem(
    "user",
    JSON.stringify({ id, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

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
            averageFirstResponseSeconds: 90,
            averageLlmFirstResponseSeconds: 3,
            averageHumanFirstResponseSeconds: 180,
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
      data: [
        {
          id: 100,
          seqNo: 1,
          senderRole: "CUSTOMER",
          messageType: "TEXT",
          content: "generated 상담 메시지",
          createdAt: "2026-05-22T00:01:00Z",
        },
      ],
    });
    mocks.updateStatus.mockResolvedValue({
      data: {
        ...assignedSession,
        status: "COMPLETED",
      },
    });
  });

  it("상담 화면에서 고객 선택 시 generated getMessages 응답을 렌더링한다", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    const customerItem = await screen.findByText("김민지");
    fireEvent.click(customerItem.closest('[role="button"]') ?? customerItem);

    expect(await screen.findByText("generated 상담 메시지")).toBeInTheDocument();
    expect(mocks.customFetch).toHaveBeenCalledWith("/api/v1/workspaces/2/consultation/queue", {
      method: "GET",
    });
    expect(mocks.getMessages).toHaveBeenCalledWith(1);
  });

  it("상담 종료 액션은 generated updateStatus를 통해 완료 상태를 전송한다", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    const customerItem = await screen.findByText("김민지");
    fireEvent.click(customerItem.closest('[role="button"]') ?? customerItem);
    await screen.findByText("generated 상담 메시지");

    fireEvent.click(screen.getByText("상담 종료"));

    await waitFor(() => {
      expect(mocks.updateStatus).toHaveBeenCalledWith(1, { status: "COMPLETED" });
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("상담이 종료되었습니다.");
  });
});
