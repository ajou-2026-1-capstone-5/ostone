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
  createUnassignedQueueSession,
  getLatestTopbarNode,
  getMessageSelectButton,
  getQueueCustomerButton,
  mockSubscribe,
  renderLatestTopbar,
  saveTestUser,
  shellContext,
  stompState,
} from "./ConsultationPage.test-helper";
import { ApiRequestError } from "@/shared/api";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { toast } from "sonner";
import { ConsultationPage } from "./ConsultationPage";

describe("ConsultationPage queue and assignment", () => {
  it("does not load or subscribe to queue without a workspace id", async () => {
    shellContext.workspace = null;

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(
        screen.getByText("현재 상담 큐가 비어 있습니다"),
      ).toBeInTheDocument();
    });

    expect(consultationApi.getQueue).not.toHaveBeenCalled();
    expect(mockSubscribe).not.toHaveBeenCalledWith(
      expect.stringContaining("consultation.queue"),
      expect.any(Function),
    );
    expect(consultationApi.getMetrics).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(getLatestTopbarNode().props.metricsViewState).toBe("empty");
    });
    const topbar = renderLatestTopbar();
    expect(topbar.getAllByText("--")).toHaveLength(2);
    topbar.unmount();
  });

  it("updates queue items from workspace queue upsert events", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(
        stompState.callbacks.has("/topic/workspaces.2.consultation.queue"),
      ).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
          }),
          startedAt: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("박서연")).toBeInTheDocument();
    });
    expect(screen.getByText("배송 문의")).toBeInTheDocument();
  });

  it("marks inactive queue item as unread when a customer message queue event arrives", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(
        stompState.callbacks.has("/topic/workspaces.2.consultation.queue"),
      ).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "배송이 아직 도착하지 않았어요",
            lastMessageRole: "CUSTOMER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText("배송이 아직 도착하지 않았어요"),
      ).toBeInTheDocument();
    });
    expect(screen.getByLabelText("읽지 않은 고객 메시지")).toBeInTheDocument();
  });

  it("clears unread state when selecting an unread queue item", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(
        stompState.callbacks.has("/topic/workspaces.2.consultation.queue"),
      ).toBe(true);
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "확인 부탁드립니다",
            lastMessageRole: "USER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByLabelText("읽지 않은 고객 메시지"),
      ).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("박서연");
    if (customerItem) fireEvent.click(customerItem);

    await waitFor(() => {
      expect(
        screen.queryByLabelText("읽지 않은 고객 메시지"),
      ).not.toBeInTheDocument();
    });
  });

  it("does not mark active or non-customer queue events as unread", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) fireEvent.click(customerItem);

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 1,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "김민지",
            handoffReason: "환불 문의",
            lastMessagePreview: "활성 세션의 새 고객 메시지",
            lastMessageRole: "CUSTOMER",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 7,
        },
      });
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_UPSERTED",
        session: {
          id: 2,
          status: "OPEN",
          channel: "WEB",
          metaJson: JSON.stringify({
            customerName: "박서연",
            handoffReason: "배송 문의",
            lastMessagePreview: "내부 확인 메모",
            lastMessageRole: "NOTE",
            lastMessageAt: new Date().toISOString(),
          }),
          startedAt: new Date(Date.now() - 10 * 60000).toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(
        screen.getByText("활성 세션의 새 고객 메시지"),
      ).toBeInTheDocument();
      expect(screen.getByText("내부 확인 메모")).toBeInTheDocument();
    });
    expect(
      screen.queryByLabelText("읽지 않은 고객 메시지"),
    ).not.toBeInTheDocument();
  });

  it("removes queue item and clears active selection from workspace queue remove events", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) fireEvent.click(customerItem);

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    act(() => {
      stompState.callbacks.get("/topic/workspaces.2.consultation.queue")?.({
        type: "SESSION_REMOVED",
        session: { id: 1 },
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("상담 종료")).not.toBeInTheDocument();
      expect(screen.queryByText("김민지")).not.toBeInTheDocument();
    });
  });

  it("shows customer banner actions after selecting a customer", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    expect(screen.getByText("김민지 고객")).toBeInTheDocument();
    expect(screen.queryByText("AI가 분류한 주제")).not.toBeInTheDocument();
    expect(screen.queryByText("카드 환불 — 부분환불")).not.toBeInTheDocument();
  });

  it("opens an unassigned session as read-only when selected", async () => {
    saveTestUser(7);
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

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(consultationApi.getMessagePage).toHaveBeenCalledWith(1, {
        page: 0,
        size: 50,
      });
    });
    expect(consultationApi.assignSession).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "배정받기" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "배정받기 전에는 메시지와 내부 메모를 보낼 수 없습니다.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it("assigns an unassigned session only when the counselor clicks claim", async () => {
    saveTestUser(7);
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

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "배정받기" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(consultationApi.assignSession).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.getAllByText("내게 배정됨").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByPlaceholderText("메시지를 입력하세요..."),
    ).not.toBeDisabled();
  });

  it("keeps the session read-only when claim fails", async () => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockResolvedValueOnce([unassignedSession]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new Error("already assigned"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "배정받기" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "상담 세션 배정에 실패했습니다.",
      );
    });
    expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "배정받기" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it.each([
    ["SESSION_NOT_ASSIGNABLE", "현재 배정할 수 없는 상담 상태입니다."],
    ["SESSION_NOT_FOUND", "상담 세션을 찾을 수 없습니다."],
    ["WORKSPACE_ACCESS_DENIED", "상담 배정 권한이 없습니다."],
    ["FORBIDDEN", "상담 배정 권한이 없습니다."],
    ["UNKNOWN_ERROR", "상담 세션 배정에 실패했습니다."],
  ])("shows a claim failure message for %s", async (code, message) => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockResolvedValueOnce([unassignedSession]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new ApiRequestError(400, code, "배정 실패"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "배정받기" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(message);
    });
    expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole("button", { name: "배정받기" }),
    ).toBeInTheDocument();
  });

  it("shows a queue sync error when refetching after claim failure fails", async () => {
    saveTestUser(7);
    const unassignedSession = createUnassignedQueueSession();
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([unassignedSession])
      .mockRejectedValueOnce(new Error("queue sync failed"));
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new Error("claim failed"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "배정받기" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "배정 실패 후 최신 대기열을 불러오지 못했습니다.",
      );
    });
    expect(
      screen.getByText("대기열을 불러오지 못했습니다."),
    ).toBeInTheDocument();
  });

  it("syncs queue and clears the selected chat when claim fails because another counselor assigned it", async () => {
    saveTestUser(7);
    vi.mocked(consultationApi.getQueue)
      .mockResolvedValueOnce([
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
      ])
      .mockResolvedValueOnce([
        {
          id: 1,
          status: "ACTIVE",
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "김민지",
            handoffReason: "환불 문의",
          }),
          startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
          assignedCounselorId: 99,
          responseMode: "HUMAN_ACTIVE",
        },
      ]);
    vi.mocked(consultationApi.assignSession).mockRejectedValueOnce(
      new ApiRequestError(
        400,
        "SESSION_ALREADY_ASSIGNED",
        "이미 다른 상담사에게 배정된 상담입니다.",
      ),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "배정받기" }),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "배정받기" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "이미 다른 상담사에게 배정된 상담입니다.",
      );
    });
    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText("다른 상담사 배정").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByText("좌측 대기 목록에서 고객을 선택해주세요"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "배정받기" }),
    ).not.toBeInTheDocument();
  });

  it("keeps sessions assigned to another counselor read-only with a reason", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 1,
        status: "ACTIVE",
        channel: "카카오톡",
        metaJson: JSON.stringify({
          customerName: "김민지",
          handoffReason: "환불 문의",
        }),
        startedAt: new Date(Date.now() - 4 * 60000).toISOString(),
        assignedCounselorId: 99,
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getAllByText("다른 상담사 배정").length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByText(
        "다른 상담사가 응대 중인 세션이므로 메시지를 보낼 수 없습니다.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.queryByRole("button", { name: "배정받기" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("메시지 전송")).toBeDisabled();
  });

  it("shows counselor response status for the assigned session without mode controls", async () => {
    saveTestUser(7);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getAllByText("상담사 응대중").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByTestId("conversation-response-status"),
    ).toHaveTextContent("상담사 응대중");
    expect(screen.queryByText("AI MODE")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI 보조만 사용" }),
    ).not.toBeInTheDocument();
    expect(consultationApi.updateResponseMode).not.toHaveBeenCalled();
  });

  it("shows AI response status for unassigned sessions without mode controls", async () => {
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
        responseMode: "AI_ACTIVE",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getAllByText("AI 응대").length).toBeGreaterThan(0);
    });
    expect(
      screen.getByTestId("conversation-response-status"),
    ).toHaveTextContent("AI 응대");
    expect(screen.queryByText("AI MODE")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI 응대중" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "상담사 응대중" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "AI 보조만 사용" }),
    ).not.toBeInTheDocument();
  });

  it("opens confirmation before releasing the current counselor assignment", async () => {
    saveTestUser(7);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    await waitFor(() => {
      expect(screen.getByText("배정 해제")).toBeEnabled();
    });

    fireEvent.click(screen.getByText("배정 해제"));

    expect(consultationApi.releaseSession).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "김민지 고객 배정 해제",
    );
    expect(
      screen.getByText(/다시 미배정 대기열로 돌아가며/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "해제 확인" }));

    await waitFor(() => {
      expect(consultationApi.releaseSession).toHaveBeenCalledWith(1);
    });
  });

  it("warns about in-progress content and preserves it when release is cancelled", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      fireEvent.click(customerItem);
    }

    const input = await screen.findByPlaceholderText("메시지를 입력하세요...");
    await user.type(input, "임시 답변");

    const memo = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(memo, "카드사 확인 필요");

    const messageGroup = getMessageSelectButton("환불 문의 드립니다.");
    if (!messageGroup) throw new Error("message group not found");
    fireEvent.click(messageGroup);

    await waitFor(() => {
      expect(screen.getByTestId("message-domain-empty")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("배정 해제"));

    expect(
      screen.getByText("메시지 입력창에 작성 중인 답변이 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("우측 패널에 저장하지 않은 내부 메모가 있습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("선택한 메시지 상세 맥락이 닫힙니다."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(consultationApi.releaseSession).not.toHaveBeenCalled();
    expect(input).toHaveValue("임시 답변");
    expect(screen.getByTestId("message-domain-empty")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(
      screen.getByPlaceholderText(
        "타임라인에 내부 메모로 남길 내용을 입력하세요...",
      ),
    ).toHaveValue("카드사 확인 필요");
  });

  it("does not render hard-coded suggestion strip when customer is active", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    expect(screen.queryByText("추천 답변")).not.toBeInTheDocument();
    expect(screen.queryByText("부분환불 가능합니다")).not.toBeInTheDocument();
    expect(screen.queryByText("환불 처리 중입니다")).not.toBeInTheDocument();
    expect(
      screen.queryByText("카드사 확인이 필요합니다"),
    ).not.toBeInTheDocument();
  });

  it("ends session when 상담 종료 is clicked", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));

    expect(consultationApi.updateStatus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /고객 이탈/ }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    await waitFor(() => {
      expect(consultationApi.updateStatus).toHaveBeenCalledWith(1, {
        status: "COMPLETED",
        resolutionOutcome: "CUSTOMER_LEFT",
        resolutionReason: undefined,
        followUpRequired: false,
      });
    });
    await waitFor(() => {
      expect(consultationApi.getMetrics).toHaveBeenCalledTimes(2);
    });

    await waitFor(() => {
      expect(screen.queryByText("상담 종료")).not.toBeInTheDocument();
    });
  });

  it("keeps the session unchanged when end session modal is cancelled", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "상담 종료" }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(consultationApi.updateStatus).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "상담 종료" }),
    ).toBeInTheDocument();
  });
});
