import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  Wrapper,
  createRoutedWrapper,
  getLatestTopbarNode,
  getMessageSelectButton,
  getQueueCustomerButton,
  mockSubscribe,
  renderLatestTopbar,
  stompState,
} from "./ConsultationPage.test-helper";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { consultationEvidenceApi } from "../../../features/consultation/api/consultationEvidenceApi";
import { toast } from "sonner";
import { ConsultationPage } from "./ConsultationPage";

describe("ConsultationPage", () => {
  it("loads consultation metrics and renders the topbar values", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getMetrics).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.averageFirstResponseSeconds).toBe(134);
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getByText("2분 14초")).toBeInTheDocument();
    expect(topbar.getByText("14건")).toBeInTheDocument();
    topbar.unmount();
  });

  it("renders metric loading state while the request is pending", async () => {
    vi.mocked(consultationApi.getMetrics).mockImplementationOnce(
      () => new Promise(() => {}),
    );

    const { unmount } = render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("loading");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("로딩중")).toHaveLength(2);
    topbar.unmount();
    unmount();
  });

  it("renders metric fallbacks when average value is null", async () => {
    vi.mocked(consultationApi.getMetrics).mockResolvedValueOnce({
      workspaceId: 2,
      periodStart: "2026-05-27T00:00:00+09:00",
      periodEnd: "2026-05-28T00:00:00+09:00",
      totalConsultationCount: 0,
      completedConsultationCount: 0,
      averageFirstResponseSeconds: null,
      averageLlmFirstResponseSeconds: null,
      averageHumanFirstResponseSeconds: null,
      llmHandledCount: 0,
      humanInterventionCount: 0,
      unresolvedSessionCount: 0,
      comparison: null,
      handledTodayCount: 0,
      llmHandledTodayCount: 0,
      humanHandledTodayCount: 0,
    });

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getMetrics).toHaveBeenCalledWith(2);
    });

    await waitFor(() => {
      expect(getLatestTopbarNode().props.handledTodayCount).toBe(0);
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getByText("--")).toBeInTheDocument();
    expect(topbar.getByText("0건")).toBeInTheDocument();
    topbar.unmount();
  });

  it("renders metric error state and shows a toast once when metrics fail", async () => {
    vi.mocked(consultationApi.getMetrics).mockRejectedValueOnce(
      new Error("Metrics failed"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "상담 지표를 불러오지 못했습니다.",
      );
    });
    expect(toast.error).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("error");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("오류")).toHaveLength(2);
    topbar.unmount();
  });

  it("renders 3-pane structure with QueuePanel, ChatPanel, and CustomerPanel", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    expect(consultationApi.getQueue).toHaveBeenCalledWith(2);
    expect(mockSubscribe).toHaveBeenCalledWith(
      "/topic/workspaces.2.consultation.queue",
      expect.any(Function),
    );
    expect(screen.getByText("상담 큐")).toBeInTheDocument();
    expect(
      screen.getByText("좌측 대기 목록에서 고객을 선택해주세요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("고객을 선택하면 정보가 표시됩니다"),
    ).toBeInTheDocument();
  });

  it("renders customer panel data from session metadata without fallback mock business values", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "정세션",
          customerInfo: {
            membershipTier: "VIP",
            contact: "010-2222-3333",
            email: "real@example.com",
          },
          orderInfo: {
            orderNumber: "ORD-SESSION-1",
            orderDate: "2026-06-01",
            paymentAmount: "22,000원",
            deliveryStatus: "결제 확인",
          },
          extractedInfo: {
            cardNumber: "2222 **** **** 3333",
            refundAmount: "5,000원",
            refundReason: "부분 취소",
            dueDate: "2026-06-05",
          },
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("정세션")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("정세션");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    expect(screen.getByText("010-2222-3333")).toBeInTheDocument();
    expect(screen.getByText("real@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("ORD-SESSION-1").length).toBeGreaterThan(0);
    expect(screen.getByText("22,000원")).toBeInTheDocument();
    expect(screen.getByText("2222 **** **** 3333")).toBeInTheDocument();
    expect(screen.getByText("5,000원")).toBeInTheDocument();
    expect(screen.queryByText("010-****-1234")).not.toBeInTheDocument();
    expect(screen.queryByText("#ORD-2024-08921")).not.toBeInTheDocument();
    expect(screen.queryByText("89,000원")).not.toBeInTheDocument();
    expect(screen.queryByText("5432 **** **** 8912")).not.toBeInTheDocument();
  });

  it("orders AI handoff queue items before normal sessions and by oldest handoff time", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "일반 고객",
          handoffRequired: false,
          handoffReason: "일반 문의",
        }),
        startedAt: "2026-06-01T11:30:00+09:00",
      },
      {
        id: 2,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "새 이관 고객",
          handoffRequired: true,
          handoffReason: "최근 승인 필요",
          handoffAt: "2026-06-01T11:00:00+09:00",
        }),
        startedAt: "2026-06-01T09:00:00+09:00",
      },
      {
        id: 3,
        status: "OPEN",
        channel: "WEB",
        metaJson: JSON.stringify({
          customerName: "오래된 이관 고객",
          handoffRequired: true,
          handoffReason: "오래된 승인 필요",
          handoffAt: "2026-06-01T10:00:00+09:00",
        }),
        startedAt: "2026-06-01T08:00:00+09:00",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("오래된 이관 고객")).toBeInTheDocument();
    });

    const queueItems = screen
      .getAllByRole("button")
      .filter((button) => button.textContent?.includes("고객"));
    expect(queueItems.map((button) => button.textContent)).toEqual([
      expect.stringContaining("오래된 이관 고객"),
      expect.stringContaining("새 이관 고객"),
      expect.stringContaining("일반 고객"),
    ]);
    expect(
      screen.getByText("연결 요청 2건 · 미배정 3건 · 진행 0건"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("상담사 연결 요청 · 미배정").length,
    ).toBeGreaterThan(0);
  });

  it("selects the route session and restores messages when opening a session URL directly", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({
          customerName: "김민지",
          handoffReason: "환불 문의",
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: null,
      },
    ]);

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/1"),
    });

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(1, {
        page: 0,
        size: 50,
      });
    });
    expect(screen.getByText("김민지 고객")).toBeInTheDocument();
    expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    expect(consultationApi.assignSession).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "배정받기" }),
    ).toBeInTheDocument();
  });

  it("loads selected message domain pack evidence into the detail panel", async () => {
    vi.mocked(
      consultationEvidenceApi.getMessageDomainPackElements,
    ).mockResolvedValueOnce({
      slots: [{ name: "주문 번호", extracted: true, value: "ORD-1" }],
      policies: [{ name: "환불 정책", extracted: true, matched: true }],
      risks: [{ name: "고액 환불", extracted: true, level: "high" }],
    });

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("김민지"));

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageItem = getMessageSelectButton("환불 문의 드립니다.");
    if (messageItem) {
      fireEvent.click(messageItem);
    }

    await waitFor(() => {
      expect(
        consultationEvidenceApi.getMessageDomainPackElements,
      ).toHaveBeenCalledWith(1, 100, {
        workspaceId: 2,
        packId: null,
        versionId: null,
      });
    });
    expect(screen.getByText("주문 번호")).toBeInTheDocument();
    expect(screen.getByText("ORD-1")).toBeInTheDocument();
    expect(screen.getByText("환불 정책")).toBeInTheDocument();
    expect(screen.getByText("고액 환불")).toBeInTheDocument();
  });

  it("keeps the consultation page usable when selected message evidence fails to load", async () => {
    vi.mocked(
      consultationEvidenceApi.getMessageDomainPackElements,
    ).mockRejectedValueOnce(new Error("evidence failed"));

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("김민지"));

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageItem = getMessageSelectButton("환불 문의 드립니다.");
    if (messageItem) {
      fireEvent.click(messageItem);
    }

    await waitFor(() => {
      expect(screen.getByTestId("message-domain-error")).toHaveTextContent(
        "근거를 불러오지 못했습니다",
      );
    });
    expect(
      screen.getByPlaceholderText("메시지를 입력하세요..."),
    ).toBeInTheDocument();
  });

  it("loads previous message pages from the top of the live chat", async () => {
    vi.mocked(consultationApi.getMessagePage)
      .mockResolvedValueOnce({
        content: [
          {
            id: 101,
            seqNo: 51,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "최근 문의입니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 0,
        size: 50,
        totalElements: 51,
        totalPages: 2,
      })
      .mockResolvedValueOnce({
        content: [
          {
            id: 10,
            seqNo: 1,
            senderRole: "CUSTOMER",
            messageType: "TEXT",
            content: "이전 문의입니다.",
            createdAt: new Date().toISOString(),
          },
        ],
        page: 1,
        size: 50,
        totalElements: 51,
        totalPages: 2,
      });

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/1"),
    });

    await waitFor(() => {
      expect(screen.getByText("최근 문의입니다.")).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", { name: "이전 메시지 불러오기" }),
    );

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenLastCalledWith(1, {
        page: 1,
        size: 50,
      });
    });
    expect(screen.getByText("이전 문의입니다.")).toBeInTheDocument();
    expect(screen.getByText("최근 문의입니다.")).toBeInTheDocument();
  });

  it("updates the browser URL when a queue session is selected", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation"),
    });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/workspaces/2/consultation/1",
      );
    });
  });

  it("shows an unavailable state for an inaccessible route session without loading messages", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/999"),
    });

    await waitFor(() => {
      expect(
        screen.getByText("요청한 상담 세션을 찾을 수 없습니다"),
      ).toBeInTheDocument();
    });
    expect(
      vi
        .mocked(consultationApi.getMessagePage)
        .mock.calls.some(([sessionId]) => sessionId === 999),
    ).toBe(false);
  });

  it("treats non-numeric route session IDs as unavailable without loading messages", async () => {
    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/abc"),
    });

    await waitFor(() => {
      expect(
        screen.getByText("요청한 상담 세션을 찾을 수 없습니다"),
      ).toBeInTheDocument();
    });
    expect(consultationApi.getMessagePage).not.toHaveBeenCalled();
  });

  it("selects a route session when it arrives later through the queue websocket", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([]);

    render(<ConsultationPage />, {
      wrapper: createRoutedWrapper("/workspaces/2/consultation/9"),
    });

    await waitFor(() => {
      expect(
        screen.getByText("요청한 상담 세션을 찾을 수 없습니다"),
      ).toBeInTheDocument();
      expect(
        stompState.callbacks.has("/topic/workspaces.2.consultation.queue"),
      ).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 9,
          status: "OPEN",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "박지훈",
            handoffReason: "배송 문의",
          }),
          startedAt: new Date().toISOString(),
          assignedCounselorId: 7,
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.queryByText("요청한 상담 세션을 찾을 수 없습니다"),
      ).not.toBeInTheDocument();
      expect(screen.getByText("박지훈 고객")).toBeInTheDocument();
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(9, {
        page: 0,
        size: 50,
      });
    });
  });
});
