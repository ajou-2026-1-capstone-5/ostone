import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MessageHistory } from "./MessageHistory";

const { getMessagePageMock, toastErrorMock, useChatMessagePageMock } = vi.hoisted(() => ({
  getMessagePageMock: vi.fn(),
  toastErrorMock: vi.fn(),
  useChatMessagePageMock: vi.fn(),
}));

vi.mock("../../api/chatHistoryApi", () => ({
  useChatMessagePage: useChatMessagePageMock,
}));

vi.mock("../../api/consultationApi", () => ({
  consultationApi: {
    getMessagePage: getMessagePageMock,
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

describe("MessageHistory", () => {
  beforeEach(() => {
    getMessagePageMock.mockReset();
    toastErrorMock.mockReset();
    useChatMessagePageMock.mockReset();
  });

  it("첫 page 이후 이전 메시지를 추가로 불러온다", async () => {
    useChatMessagePageMock.mockReturnValue({
      data: {
        content: [
          {
            id: 2,
            seqNo: 2,
            senderRole: "AGENT",
            messageType: "TEXT",
            content: "최근 답변입니다",
            createdAt: "2026-05-22T00:01:00Z",
          },
        ],
        page: 0,
        size: 50,
        totalElements: 2,
        totalPages: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    getMessagePageMock.mockResolvedValue({
      content: [
        {
          id: 1,
          seqNo: 1,
          senderRole: "CUSTOMER",
          messageType: "TEXT",
          content: "이전 문의입니다",
          createdAt: "2026-05-22T00:00:00Z",
        },
      ],
      page: 1,
      size: 50,
      totalElements: 2,
      totalPages: 2,
    });

    render(<MessageHistory sessionId="7" />);

    expect(screen.getByText("최근 답변입니다")).toBeTruthy();
    expect(screen.getByText("1/2개 메시지")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "이전 메시지 불러오기" }));

    await waitFor(() => {
      expect(getMessagePageMock).toHaveBeenCalledWith(7, { page: 1, size: 50 });
    });
    expect(await screen.findByText("이전 문의입니다")).toBeTruthy();
    expect(screen.getByText("2/2개 메시지")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "이전 메시지 불러오기" })).toBeNull();
  });

  it("이전 메시지 로드 실패 시 toast로 알린다", async () => {
    useChatMessagePageMock.mockReturnValue({
      data: {
        content: [
          {
            id: 2,
            seqNo: 2,
            senderRole: "AGENT",
            messageType: "TEXT",
            content: "최근 답변입니다",
            createdAt: "2026-05-22T00:01:00Z",
          },
        ],
        page: 0,
        size: 50,
        totalElements: 2,
        totalPages: 2,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    getMessagePageMock.mockRejectedValue(new Error("load failed"));

    render(<MessageHistory sessionId="7" />);

    fireEvent.click(screen.getByRole("button", { name: "이전 메시지 불러오기" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("이전 메시지를 불러오지 못했습니다.");
    });
  });
});
