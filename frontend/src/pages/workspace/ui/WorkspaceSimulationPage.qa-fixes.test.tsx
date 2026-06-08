import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/shared/api";
import {
  candidate,
  detail,
  failedReplayResult,
  goldenCase,
  mockedSimulationApi,
  openCandidateTab,
  renderPage,
  replayResult,
  toast,
} from "./WorkspaceSimulationPage.test-helper";

function mockGoldenCaseList() {
  mockedSimulationApi.listGoldenCases.mockResolvedValue({
    content: [goldenCase],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
}

function mockReadyForReviewCandidate() {
  mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
    content: [{ ...candidate, status: "READY_FOR_REVIEW", reviewSessionId: 200, reviewTaskId: 300 }],
    page: 0,
    size: 20,
    totalElements: 1,
    totalPages: 1,
  });
}

describe("WorkspaceSimulationPage QA fixes", () => {
  it("세션 생성 성공 시 성공 토스트를 띄운다", async () => {
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("새 시뮬레이션 세션을 만들었습니다.");
    });
  });

  it("세션 생성 실패 시 구체적인 에러 메시지를 노출한다", async () => {
    mockedSimulationApi.createSession.mockRejectedValueOnce(
      new ApiRequestError(409, "SIMULATION_SESSION_CONFLICT", "세션이 이미 있습니다."),
    );
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "시뮬레이션 세션을 만들지 못했습니다: 세션이 이미 있습니다.",
      );
    });
    expect(toast.success).not.toHaveBeenCalledWith("새 시뮬레이션 세션을 만들었습니다.");
  });

  it("세션 생성 후 목록 새로고침이 실패해도 생성 성공은 유지한다", async () => {
    renderPage();
    // 초기 세션 로드가 끝난 뒤(이 시점 listSessions 1회 소비)에 다음 reload만 실패시킨다.
    await screen.findByText("환불하고 싶어요");
    mockedSimulationApi.listSessions.mockRejectedValueOnce(new Error("refresh failed"));

    fireEvent.click(screen.getByRole("button", { name: "세션 생성" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("새 시뮬레이션 세션을 만들었습니다.");
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("세션 목록을 새로고침하지 못했습니다.");
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      "시뮬레이션 세션을 만들지 못했습니다: refresh failed",
    );
  });

  it("replay가 PASS면 성공 토스트를 띄운다", async () => {
    mockGoldenCaseList();
    mockedSimulationApi.replayGoldenCase.mockResolvedValue(replayResult);
    renderPage();

    await screen.findByText("환불하고 싶어요");
    fireEvent.click(await screen.findByRole("button", { name: "환불 검증 replay" }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("검증 케이스 replay가 통과했습니다.");
    });
  });

  it("replay가 FAIL이면 실패 토스트로 안내하고 성공 토스트는 띄우지 않는다", async () => {
    mockGoldenCaseList();
    mockedSimulationApi.replayGoldenCase.mockResolvedValue(failedReplayResult);
    renderPage();

    await screen.findByText("환불하고 싶어요");
    fireEvent.click(await screen.findByRole("button", { name: "환불 검증 replay" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        `검증 케이스 replay가 실패했습니다: ${failedReplayResult.failureSummary}`,
      );
    });
    expect(toast.success).not.toHaveBeenCalledWith("검증 케이스 replay가 통과했습니다.");
  });

  it("기대 intent/workflow/state를 선택 가능한 datalist 옵션으로 제시한다", async () => {
    mockedSimulationApi.getSession.mockResolvedValue({
      ...detail,
      matchedWorkflow: {
        ...detail.matchedWorkflow,
        graphJson: { nodes: [{ id: "ask_order_no" }, { id: "verify_policy" }], edges: [] },
      },
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("기대 intent")).toHaveValue("refund_request");
    });
    const intentOptions = document.getElementById("expected-intent-options");
    const workflowOptions = document.getElementById("expected-workflow-options");
    const stateOptions = document.getElementById("expected-state-options");
    expect(intentOptions?.querySelector('option[value="refund_request"]')).not.toBeNull();
    expect(workflowOptions?.querySelector('option[value="refund_workflow"]')).not.toBeNull();
    expect(workflowOptions?.querySelector('option[value="refund.standard"]')).not.toBeNull();
    expect(stateOptions?.querySelector('option[value="ask_order_no"]')).not.toBeNull();
    expect(stateOptions?.querySelector('option[value="collect_order_no"]')).not.toBeNull();
  });

  it("리뷰 입력 placeholder를 중립 문구로 표시한다", async () => {
    mockReadyForReviewCandidate();
    renderPage();

    await openCandidateTab();
    const reasonInput = await screen.findByLabelText("개선 후보 검토 의견");
    expect(reasonInput).toHaveAttribute("placeholder", "검토 의견 — 반려 시 필수 입력");
  });

  it("반려·승인 버튼을 기본 크기로 렌더링한다", async () => {
    mockReadyForReviewCandidate();
    renderPage();

    await openCandidateTab();
    const rejectButton = await screen.findByRole("button", { name: "반려" });
    const approveButton = screen.getByRole("button", { name: "승인" });
    expect(rejectButton).toHaveAttribute("data-size", "default");
    expect(rejectButton).toHaveAttribute("data-variant", "outline");
    expect(approveButton).toHaveAttribute("data-size", "default");
  });
});
