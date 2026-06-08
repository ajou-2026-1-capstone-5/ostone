/* eslint-disable react-refresh/only-export-components */
import { vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import "@testing-library/jest-dom/vitest";

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

type RealtimePayload = {
  id?: string | number;
  seqNo?: number;
  senderRole?: string;
  content?: string | null;
  createdAt?: string | null;
  timestamp?: string | null;
  type?: string;
  session?: Record<string, unknown>;
};

const { mockSubscribe, mockSendTo, stompState } = vi.hoisted(() => {
  const mockUnsubscribe = vi.fn();
  const stompState = {
    connectionStatus: "CONNECTED" as
      | "CONNECTING"
      | "CONNECTED"
      | "DISCONNECTED"
      | "ERROR",
    latestCallback: null as ((msg: RealtimePayload) => void) | null,
    onServerError: null as ((error: unknown) => void) | null,
    callbacks: new Map<string, (msg: RealtimePayload) => void>(),
  };
  return {
    mockUnsubscribe,
    mockSubscribe: vi.fn(
      (topic: string, callback: (msg: RealtimePayload) => void) => {
        stompState.latestCallback = callback;
        stompState.callbacks.set(topic, callback);
        return mockUnsubscribe;
      },
    ),
    mockSendTo: vi.fn(),
    stompState,
  };
});

const shellContext = {
  setTopbarRight: vi.fn(),
  setCrumbs: vi.fn(),
  workspace: { id: 2, name: "QA Alpha" } as { id: number; name: string } | null,
};

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom",
    );
  return {
    ...actual,
    useOutletContext: () => shellContext,
  };
});

vi.mock("../../../features/consultation/api/consultationApi", () => ({
  consultationApi: {
    getQueue: vi.fn(() =>
      Promise.resolve([
        {
          id: 1,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "김민지",
            handoffReason: "환불 문의",
          }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 7,
          responseMode: "HUMAN_ACTIVE",
        },
      ]),
    ),
    getMessages: vi.fn(() =>
      Promise.resolve([
        {
          id: 100,
          seqNo: 1,
          senderRole: "CUSTOMER",
          messageType: "TEXT",
          content: "환불 문의 드립니다.",
          createdAt: new Date().toISOString(),
        },
      ]),
    ),
    getMessagePage: vi.fn(() =>
      Promise.resolve({
        content: [
          {
            id: 100,
            seqNo: 1,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "환불 문의 드립니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 0,
        size: 50,
        totalElements: 1,
        totalPages: 1,
      }),
    ),
    updateStatus: vi.fn(() => Promise.resolve({})),
    assignSession: vi.fn((sessionId: number) =>
      Promise.resolve({
        id: sessionId,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({
          customerName: "김민지",
          handoffReason: "환불 문의",
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: 7,
        responseMode: "HUMAN_ACTIVE",
      }),
    ),
    releaseSession: vi.fn(() =>
      Promise.resolve({
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({
          customerName: "김민지",
          handoffReason: "환불 문의",
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
        responseMode: "AI_ACTIVE",
      }),
    ),
    updateResponseMode: vi.fn(
      (sessionId: number, counselorId: number, responseMode: string) =>
        Promise.resolve({
          id: sessionId,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "김민지",
            handoffReason: "환불 문의",
          }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: counselorId,
          responseMode,
        }),
    ),
    getMetrics: vi.fn(() =>
      Promise.resolve({
        workspaceId: 2,
        periodStart: "2026-05-27T00:00:00+09:00",
        periodEnd: "2026-05-28T00:00:00+09:00",
        totalConsultationCount: 20,
        completedConsultationCount: 14,
        averageFirstResponseSeconds: 134,
        averageLlmFirstResponseSeconds: 3,
        averageHumanFirstResponseSeconds: 420,
        llmHandledCount: 9,
        humanInterventionCount: 5,
        unresolvedSessionCount: 2,
        comparison: null,
        handledTodayCount: 14,
        llmHandledTodayCount: 9,
        humanHandledTodayCount: 5,
      }),
    ),
    sendMessage: vi.fn((_sessionId: number, content: string, isNote = false) =>
      Promise.resolve({
        id: 200,
        seqNo: 2,
        senderRole: isNote ? "NOTE" : "AGENT",
        messageType: "TEXT",
        content,
        createdAt: new Date().toISOString(),
      }),
    ),
    generateDraftResponse: vi.fn(() =>
      Promise.resolve({
        content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
      }),
    ),
  },
}));

vi.mock("../../../features/consultation/api/consultationEvidenceApi", () => ({
  consultationEvidenceApi: {
    getMessageDomainPackElements: vi.fn(() =>
      Promise.resolve({ slots: [], policies: [], risks: [] }),
    ),
  },
}));

vi.mock("../../../features/consultation/api/llmToolWorkflowApi", () => ({
  getCurrentWorkflow: vi.fn(() => Promise.resolve(null)),
  isMatchedWorkflow: (payload: unknown) =>
    !!payload &&
    (payload as { workflowDefinitionId?: number | null })
      .workflowDefinitionId != null,
}));

vi.mock("@/shared/lib/websocket", () => ({
  useStomp: (options?: { onServerError?: (error: unknown) => void }) => {
    stompState.onServerError = options?.onServerError ?? null;
    return {
      connectionStatus: stompState.connectionStatus,
      subscribe: mockSubscribe,
      sendTo: mockSendTo,
      sendMessage: vi.fn(),
      lastMessage: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
    };
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

const getQueueCustomerButton = (customerName: string) =>
  screen.getByRole("button", { name: new RegExp(customerName) });

const getMessageSelectButton = (messageContent: string) =>
  screen.getByRole("button", { name: new RegExp(messageContent) });

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function createRoutedWrapper(initialPath: string) {
  return function RoutedWrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <LocationProbe />
        <Routes>
          <Route
            path="/workspaces/:workspaceId/consultation"
            element={children}
          />
          <Route
            path="/workspaces/:workspaceId/consultation/:sessionId"
            element={children}
          />
        </Routes>
      </MemoryRouter>
    );
  };
}

function saveTestUser(id: number) {
  window.localStorage.setItem(
    "user",
    JSON.stringify({
      id,
      email: "agent@example.com",
      name: "상담사",
      role: "OPERATOR",
    }),
  );
}

function createUnassignedQueueSession() {
  return {
    id: 1,
    status: "OPEN" as const,
    channel: "카카오톡",
    metaJson: JSON.stringify({
      customerName: "김민지",
      handoffReason: "환불 문의",
    }),
    startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
    assignedCounselorId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  stompState.connectionStatus = "CONNECTED";
  stompState.latestCallback = null;
  stompState.onServerError = null;
  stompState.callbacks.clear();
  shellContext.workspace = { id: 2, name: "QA Alpha" };
  window.alert = vi.fn();
  window.localStorage.clear();
  saveTestUser(7);
});

const getLatestTopbarNode = () => {
  const node = [...shellContext.setTopbarRight.mock.calls]
    .reverse()
    .find(([value]) => value !== undefined)?.[0];
  if (!node) {
    throw new Error("Topbar node was not set");
  }
  return node as React.ReactElement<{
    metricsViewState?: "loading" | "error" | "empty" | "ready";
    averageFirstResponseSeconds?: number | null;
    handledTodayCount?: number | null;
  }>;
};

const renderLatestTopbar = () => {
  const node = getLatestTopbarNode();
  return render(<>{node}</>);
};

export {
  Wrapper,
  createRoutedWrapper,
  createUnassignedQueueSession,
  getLatestTopbarNode,
  getMessageSelectButton,
  getQueueCustomerButton,
  mockSendTo,
  mockSubscribe,
  renderLatestTopbar,
  saveTestUser,
  shellContext,
  stompState,
};
export type { RealtimePayload };
