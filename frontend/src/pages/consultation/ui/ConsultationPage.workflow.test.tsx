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
  mockSendTo,
  stompState,
} from "./ConsultationPage.test-helper";
import { consultationApi } from "../../../features/consultation/api/consultationApi";
import { getCurrentWorkflow } from "../../../features/consultation/api/llmToolWorkflowApi";
import { toast } from "sonner";
import { ConsultationPage } from "./ConsultationPage";

describe("ConsultationPage workflow matching", () => {
  describe("MatchedWorkflowBar integration", () => {
    const matchedPayload = {
      sessionId: 1,
      workspaceId: 2,
      domainPackId: 42,
      domainPackVersionId: 12,
      executionId: 41,
      executionStatus: "RUNNING",
      currentState: "COLLECT_INFO",
      workflowDefinitionId: 88,
      workflowCode: "REFUND_FLOW",
      workflowName: "환불 워크플로우",
      workflowDescription: "환불 흐름",
      graphJson: {
        nodes: [{ id: "n1", type: "START", label: "start" }],
        edges: [],
      },
    };

    it("does not render the bar or skeleton when no session is active", async () => {
      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      expect(
        screen.queryByTestId("matched-workflow-bar"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("matched-workflow-bar-skeleton"),
      ).not.toBeInTheDocument();
      expect(getCurrentWorkflow).not.toHaveBeenCalled();
    });

    it("shows skeleton immediately after selecting a session and replaces it once workflow is matched", async () => {
      let resolveFetch: ((value: typeof matchedPayload) => void) | null = null;
      vi.mocked(getCurrentWorkflow).mockImplementationOnce(
        () =>
          new Promise<typeof matchedPayload>((resolve) => {
            resolveFetch = resolve;
          }),
      );

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(
          screen.getByTestId("matched-workflow-bar-skeleton"),
        ).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("matched-workflow-bar"),
      ).not.toBeInTheDocument();

      await act(async () => {
        resolveFetch?.(matchedPayload);
      });

      await waitFor(() => {
        expect(screen.getByTestId("matched-workflow-bar")).toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("matched-workflow-bar-skeleton"),
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId("matched-workflow-bar-title"),
      ).toHaveTextContent("환불 워크플로우");
      // collapsed by default — meta only appears after toggle
      expect(
        screen.queryByTestId("matched-workflow-bar-meta"),
      ).not.toBeInTheDocument();
    });

    it("hides both skeleton and bar when the workflow lookup returns null", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(null);

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("matched-workflow-bar-skeleton"),
        ).not.toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("matched-workflow-bar"),
      ).not.toBeInTheDocument();
    });

    it("hides the bar without showing an error toast when the workflow lookup fails", async () => {
      vi.mocked(getCurrentWorkflow).mockRejectedValueOnce(new Error("boom"));

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledWith(1);
      });

      await waitFor(() => {
        expect(
          screen.queryByTestId("matched-workflow-bar-skeleton"),
        ).not.toBeInTheDocument();
      });
      expect(
        screen.queryByTestId("matched-workflow-bar"),
      ).not.toBeInTheDocument();
      // 매칭 바는 보조 패널이므로 조회 실패가 운영자에게 토스트로 노출되지 않아야 한다.
      expect(toast.error).not.toHaveBeenCalledWith(
        "워크플로우 정보를 불러오지 못했습니다.",
      );
    });

    it("refetches the workflow after an assistant message arrives via STOMP", async () => {
      vi.mocked(getCurrentWorkflow)
        .mockResolvedValueOnce(matchedPayload)
        .mockResolvedValueOnce({ ...matchedPayload, currentState: "REVIEW" });

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(getCurrentWorkflow).toHaveBeenCalledTimes(1);
      });

      const chatTopicCallback = stompState.callbacks.get("/topic/chat.1");
      expect(chatTopicCallback).toBeDefined();

      await act(async () => {
        chatTopicCallback?.({
          id: "assistant-1",
          senderRole: "ASSISTANT",
          content: "도움이 필요하신 내용을 알려주세요",
          createdAt: new Date().toISOString(),
        });
      });

      await waitFor(
        () => {
          expect(getCurrentWorkflow).toHaveBeenCalledTimes(2);
        },
        { timeout: 1500 },
      );
    });

    it("inserts a matched workflow draft into the message input without sending it", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(matchedPayload);
      vi.mocked(consultationApi.generateDraftResponse).mockResolvedValueOnce({
        content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
      });

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(screen.getByLabelText("답변 초안 삽입")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText("답변 초안 삽입"));

      await waitFor(() => {
        expect(consultationApi.generateDraftResponse).toHaveBeenCalledWith(1);
      });
      expect(screen.getByPlaceholderText("메시지를 입력하세요...")).toHaveValue(
        "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
      );
      expect(mockSendTo).not.toHaveBeenCalledWith(
        "/app/chat.counselor.send",
        expect.objectContaining({
          content: "주문번호를 확인해주시면 환불 상태를 안내드리겠습니다.",
        }),
      );
    });

    it("keeps the existing input and shows a toast when draft generation fails", async () => {
      vi.mocked(getCurrentWorkflow).mockResolvedValueOnce(matchedPayload);
      vi.mocked(consultationApi.generateDraftResponse).mockRejectedValueOnce(
        new Error("draft failed"),
      );

      render(<ConsultationPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText("김민지")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("김민지"));

      await waitFor(() => {
        expect(screen.getByLabelText("답변 초안 삽입")).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText("메시지를 입력하세요...");
      await userEvent.type(input, "기존 작성 내용");
      fireEvent.click(screen.getByLabelText("답변 초안 삽입"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "답변 초안을 생성하지 못했습니다. 기존 입력 내용은 유지됩니다.",
        );
      });
      expect(input).toHaveValue("기존 작성 내용");
    });
  });
});
