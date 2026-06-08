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
  getQueueCustomerButton,
  mockSendTo,
  mockSubscribe,
  shellContext,
  stompState,
} from "./ConsultationPage.test-helper";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { toast } from "sonner";
import { ConsultationPage } from "./ConsultationPage";

describe("ConsultationPage detail and error states", () => {
  it("cleans up topbar and crumbs on unmount", () => {
    const { unmount } = render(<ConsultationPage />, { wrapper: Wrapper });
    unmount();
    expect(shellContext.setTopbarRight).toHaveBeenCalledWith(undefined);
    expect(shellContext.setCrumbs).toHaveBeenCalledWith([]);
  });

  it("shows MessageDetailPanel when a message is clicked and hides it on close", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 근거 없음")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("닫기"));

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("deselects message when the same message is clicked again", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 근거 없음")).toBeInTheDocument();
    });

    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("opens detail panel with Enter key and closes on re-Enter", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageButton = screen.getByRole("button", {
      name: /환불 문의 드립니다/,
    });
    messageButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("연결된 근거 없음")).toBeInTheDocument();
    });

    messageButton.focus();
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
    });
  });

  it("opens detail panel with Space key", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageButton = screen.getByRole("button", {
      name: /환불 문의 드립니다/,
    });
    messageButton.focus();
    await user.keyboard(" ");

    await waitFor(() => {
      expect(screen.getByText("연결된 근거 없음")).toBeInTheDocument();
    });
  });

  it("handles empty startedAt in queue items to set waitMinutes to 0", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 2,
        status: "OPEN",
        channel: "카카오톡",
        metaJson: JSON.stringify({
          customerName: "이영희",
          handoffReason: "환불 문의",
        }),
        startedAt: "",
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("이영희")).toBeInTheDocument();
    });
    expect(screen.getByText(/0분 전/)).toBeInTheDocument();
  });

  it("handles metaJson parse error gracefully by using fallback metadata", async () => {
    vi.mocked(consultationApi.getQueue).mockResolvedValueOnce([
      {
        id: 3,
        status: "OPEN",
        channel: "네이버톡톡",
        metaJson: "{invalid-json}",
        startedAt: new Date().toISOString(),
      },
    ]);

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  it("shows queue load error state and retries the snapshot request", async () => {
    vi.mocked(consultationApi.getQueue).mockRejectedValueOnce(
      new Error("Network Error"),
    );
    const user = userEvent.setup();

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("대기열을 불러오지 못했습니다.");
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "대기열을 불러오지 못했습니다.",
    );

    await user.click(screen.getByText("다시 시도"));

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });
  });

  it("loads queue only once on initial mount and does not spam toast errors", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const errorToasts = vi
      .mocked(toast.error)
      .mock.calls.filter(
        ([message]) => message === "대기열을 불러오지 못했습니다.",
      );
    expect(errorToasts).toHaveLength(0);
  });

  it("shows a queue sync notice while the websocket connection is unstable", async () => {
    stompState.connectionStatus = "ERROR";

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });
    expect(
      screen.getByText(
        "실시간 연결이 불안정합니다. 복구되면 대기열을 다시 동기화합니다.",
      ),
    ).toBeInTheDocument();
  });

  it("registers queue subscription intent while initially disconnected", async () => {
    stompState.connectionStatus = "DISCONNECTED";

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });
    expect(mockSubscribe).toHaveBeenCalledWith(
      "/topic/workspaces.2.consultation.queue",
      expect.any(Function),
    );
  });

  it("refetches the queue snapshot after websocket reconnect", async () => {
    stompState.connectionStatus = "DISCONNECTED";
    const { rerender } = render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(1);
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    stompState.connectionStatus = "CONNECTED";
    rerender(<ConsultationPage />);

    await waitFor(() => {
      expect(consultationApi.getQueue).toHaveBeenCalledTimes(2);
    });
    expect(mockSubscribe).toHaveBeenCalledWith(
      "/topic/workspaces.2.consultation.queue",
      expect.any(Function),
    );
  });

  it("deduplicates queue error toast across multiple failed loads", async () => {
    vi.mocked(consultationApi.getQueue)
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockRejectedValueOnce(new Error("Network Error"));
    const user = userEvent.setup();

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("대기열을 불러오지 못했습니다.");
    });

    let queueErrorToasts = vi
      .mocked(toast.error)
      .mock.calls.filter(
        ([message]) => message === "대기열을 불러오지 못했습니다.",
      );
    expect(queueErrorToasts).toHaveLength(1);

    await user.click(screen.getByText("다시 시도"));

    await waitFor(() => {
      queueErrorToasts = vi
        .mocked(toast.error)
        .mock.calls.filter(
          ([message]) => message === "대기열을 불러오지 못했습니다.",
        );
      expect(queueErrorToasts).toHaveLength(2);
    });
  });

  it("shows error toast when loading messages fails", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    vi.mocked(consultationApi.getMessagePage).mockRejectedValueOnce(
      new Error("DB Error"),
    );

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) {
      customerItem.click();
    }

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("메시지를 불러오지 못했습니다.");
    });
  });

  it("clears selectedMessageId if the selected message is no longer in messages list", async () => {
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

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
          channel: "카카오톡",
          metaJson: JSON.stringify({
            customerName: "홍길동",
            handoffReason: "기타 문의",
          }),
          startedAt: new Date().toISOString(),
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText("홍길동")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("환불 문의 드립니다.")).toBeInTheDocument();
    });

    const messageEl = screen.getByText("환불 문의 드립니다.");
    fireEvent.click(messageEl);

    await waitFor(() => {
      expect(screen.getByText("연결된 근거 없음")).toBeInTheDocument();
    });

    vi.mocked(consultationApi.getMessagePage).mockResolvedValueOnce({
      content: [],
      page: 0,
      size: 50,
      totalElements: 0,
      totalPages: 0,
    });

    const hongEl = getQueueCustomerButton("홍길동");
    if (hongEl) hongEl.click();

    await waitFor(() => {
      expect(screen.getByText("고객 정보")).toBeInTheDocument();
      expect(screen.queryByText("연결된 근거 없음")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when ending session fails", async () => {
    vi.mocked(consultationApi.updateStatus).mockRejectedValueOnce(
      new Error("API Error"),
    );

    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    await waitFor(() => {
      expect(screen.getByText("상담 종료")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "상담 종료" }));
    fireEvent.click(screen.getByRole("button", { name: /해결됨/ }));
    fireEvent.click(screen.getByRole("button", { name: "종료 확인" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("세션 종료 실패");
    });
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("updates active customer's memo when typing in the textarea", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) customerItem.click();

    const textarea = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(textarea, "고객이 매우 다급함");

    expect(textarea).toHaveValue("고객이 매우 다급함");
  });

  it("saves the customer memo as an internal note message", async () => {
    const user = userEvent.setup();
    render(<ConsultationPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText("김민지")).toBeInTheDocument();
    });

    const customerItem = getQueueCustomerButton("김민지");
    if (customerItem) fireEvent.click(customerItem);

    const textarea = await screen.findByPlaceholderText(
      "타임라인에 내부 메모로 남길 내용을 입력하세요...",
    );
    await user.type(textarea, "카드사 확인 필요");
    await user.click(screen.getByText("내부 메모로 남기기"));

    await waitFor(() => {
      expect(mockSendTo).toHaveBeenCalledWith("/app/chat.counselor.send", {
        sessionId: 1,
        content: "카드사 확인 필요",
        isNote: true,
      });
    });
    expect(consultationApi.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByText("카드사 확인 필요")).toBeInTheDocument();
  });
});
