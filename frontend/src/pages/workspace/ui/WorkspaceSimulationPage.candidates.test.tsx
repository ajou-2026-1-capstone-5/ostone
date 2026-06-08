import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SimulationImprovementCandidate } from "@/features/simulation";
import {
  arrayDraftPatchJson,
  candidate,
  candidateWithType,
  mockedSimulationApi,
  openCandidateTab,
  openFeedbackTab,
  renderPage,
  toast,
  validDraftPatchJson,
} from "./WorkspaceSimulationPage.test-helper";

describe("WorkspaceSimulationPage improvement candidates", () => {
  it("개선 후보 상태를 변경하고 후보 목록을 새로고침한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    fireEvent.click(await screen.findByRole("button", { name: "리뷰 요청" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.updateImprovementCandidateStatus,
      ).toHaveBeenCalledWith(1, 1000, {
        status: "READY_FOR_REVIEW",
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "개선 후보 상태를 변경했습니다.",
    );
    await waitFor(() => {
      expect(
        mockedSimulationApi.listImprovementCandidates,
      ).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("tab", { name: "개선 후보" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("개선 후보 상태 변경 후 목록 새로고침 실패는 변경 실패로 처리하지 않는다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    const requestButton = await screen.findByRole("button", {
      name: "리뷰 요청",
    });
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("refresh failed"),
    );
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(
        mockedSimulationApi.updateImprovementCandidateStatus,
      ).toHaveBeenCalledWith(1, 1000, {
        status: "READY_FOR_REVIEW",
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      "개선 후보 상태를 변경했습니다.",
    );
    await waitFor(() => {
      expect(
        screen.getByText("개선 후보 목록을 불러오지 못했습니다."),
      ).toBeInTheDocument();
    });
    expect(toast.error).not.toHaveBeenCalledWith(
      "개선 후보 목록을 불러오지 못했습니다.",
    );
    expect(toast.error).not.toHaveBeenCalledWith(
      "개선 후보 상태를 변경하지 못했습니다.",
    );
  });

  it("개선 후보 유형 라벨을 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        candidateWithType(1001, "INTENT_DESCRIPTION_EXAMPLE"),
        candidateWithType(1002, "POLICY_CONDITION"),
        candidateWithType(1003, "RISK_RULE"),
        candidateWithType(1004, "WORKFLOW_STATE_TRANSITION"),
        candidateWithType(1005, "HANDOFF_CONDITION"),
        candidateWithType(1006, "RESPONSE_COPY"),
        candidateWithType(1007, "OTHER"),
        candidateWithType(
          1008,
          "CUSTOM" as SimulationImprovementCandidate["candidateType"],
        ),
      ],
      page: 0,
      size: 20,
      totalElements: 8,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(screen.getByRole("tab", { name: "개선 후보" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByText("intent 설명/예시")).toBeInTheDocument();
    expect(screen.getByText("policy 조건")).toBeInTheDocument();
    expect(screen.getByText("risk rule")).toBeInTheDocument();
    expect(screen.getByText("workflow 전이")).toBeInTheDocument();
    expect(screen.getByText("handoff 조건")).toBeInTheDocument();
    expect(screen.getByText("응답 문구")).toBeInTheDocument();
    expect(screen.getAllByText("기타")).toHaveLength(1);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
    expect(screen.getAllByText("초안").length).toBeGreaterThan(0);
    expect(screen.getAllByText("변경 전").length).toBeGreaterThan(0);
    expect(screen.getAllByText("근거").length).toBeGreaterThan(0);
  });

  it("개선 후보 draft patch 변경 상세를 표시하고 확인 전 승인을 막는다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: validDraftPatchJson,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(await screen.findByText("Draft patch 검토")).toBeInTheDocument();
    expect(screen.getByText("UPDATE_DESCRIPTION")).toBeInTheDocument();
    expect(screen.getAllByText("SLOT · #55 · orderNo").length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText("초안 변경 요약")).toBeInTheDocument();
    expect(
      screen.getAllByText("주문번호를 묻지 않았습니다.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("주문번호를 먼저 요청합니다.").length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByText("simulation feedback #900 (session #10, turn #1)"),
    ).toBeInTheDocument();

    const approveButton = screen.getByRole("button", { name: "승인" });
    expect(approveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "변경 상세 확인" }));
    expect(
      screen.getByRole("button", { name: "변경 확인 완료" }),
    ).toBeDisabled();
    expect(approveButton).not.toBeDisabled();
  });

  it("draft patch changes 배열의 변경값과 기본 표시를 검토한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: arrayDraftPatchJson,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(await screen.findByText("작업 미지정")).toBeInTheDocument();
    expect(screen.getAllByText("SLOT").length).toBeGreaterThan(0);
    expect(screen.getByText("변경 3")).toBeInTheDocument();
    expect(screen.getByText('{"required":false}')).toBeInTheDocument();
    expect(screen.getByText("true")).toBeInTheDocument();
    expect(
      screen.getAllByText("simulation feedback #900").length,
    ).toBeGreaterThan(0);
  });

  it("draft patch 정보가 없으면 승인할 수 없음을 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: "{}",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(
      await screen.findByText(
        "draft patch 정보가 없습니다. 변경 전/후 필드를 확인할 수 없습니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "변경 상세 확인" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
  });

  it("draft patch가 객체 형식이 아니면 승인할 수 없음을 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: '"not-object"',
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(
      await screen.findByText(
        "draft patch가 객체 형식이 아니거나 비어 있습니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('"not-object"')).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
  });

  it("draft patch JSON이 파싱되지 않으면 원문과 오류 상태를 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: "{invalid-json",
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    expect(
      await screen.findByText("draft patch JSON을 해석할 수 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("{invalid-json")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
  });

  it("개선 후보 목록 로드 실패는 패널 내부 오류와 재시도를 제공한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockRejectedValueOnce(
      new Error("load failed"),
    );
    renderPage();

    await openCandidateTab();
    expect(
      await screen.findByText("개선 후보 목록을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(
      "개선 후보 목록을 불러오지 못했습니다.",
    );

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));

    expect(
      await screen.findByText("조건에 맞는 개선 후보가 없습니다."),
    ).toBeInTheDocument();
  });

  it("개선 후보 생성 실패를 토스트로 알린다", async () => {
    renderPage();

    await screen.findByText("환불하고 싶어요");
    await openFeedbackTab();
    mockedSimulationApi.createImprovementCandidate.mockRejectedValueOnce(
      new Error("create failed"),
    );
    fireEvent.click(screen.getByRole("button", { name: "후보" }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "개선 후보를 생성하지 못했습니다.",
      );
    });
  });

  it("개선 후보 상태 변경 실패를 토스트로 알린다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [candidate],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    const requestButton = await screen.findByRole("button", {
      name: "리뷰 요청",
    });
    mockedSimulationApi.updateImprovementCandidateStatus.mockRejectedValueOnce(
      new Error("update failed"),
    );
    fireEvent.click(requestButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "개선 후보 상태를 변경하지 못했습니다.",
      );
    });
  });

  it("READY_FOR_REVIEW 개선 후보를 승인하고 목록을 새로고침한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
          draftPatchJson: validDraftPatchJson,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    fireEvent.click(
      await screen.findByRole("button", { name: "변경 상세 확인" }),
    );
    fireEvent.click(await screen.findByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.approveImprovementCandidate,
      ).toHaveBeenCalledWith(1, 1000, {
        reason: "시뮬레이션 리뷰 승인",
      });
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringContaining("적용 version #102"),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "적용 version #102",
    );
    expect(screen.getByRole("status")).toHaveTextContent("review session #200");
    expect(screen.getByRole("status")).toHaveTextContent("review task #300");
    await waitFor(() => {
      expect(
        mockedSimulationApi.listImprovementCandidates,
      ).toHaveBeenCalledTimes(2);
      expect(mockedSimulationApi.listFeedback).toHaveBeenCalledTimes(2);
    });
  });

  it("반려 사유가 없으면 READY_FOR_REVIEW 개선 후보를 반려하지 않는다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    fireEvent.click(await screen.findByRole("button", { name: "반려" }));

    expect(toast.error).toHaveBeenCalledWith("반려 사유를 입력하세요.");
    expect(
      mockedSimulationApi.rejectImprovementCandidate,
    ).not.toHaveBeenCalled();
  });

  it("READY_FOR_REVIEW 개선 후보를 반려하고 사유를 전달한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue({
      content: [
        {
          ...candidate,
          status: "READY_FOR_REVIEW",
          reviewSessionId: 200,
          reviewTaskId: 300,
        },
      ],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
    });
    renderPage();

    await openCandidateTab();
    fireEvent.change(await screen.findByLabelText("개선 후보 반려 사유"), {
      target: { value: "근거가 부족합니다." },
    });
    fireEvent.click(screen.getByRole("button", { name: "반려" }));

    await waitFor(() => {
      expect(
        mockedSimulationApi.rejectImprovementCandidate,
      ).toHaveBeenCalledWith(1, 1000, {
        reason: "근거가 부족합니다.",
      });
    });
    expect(toast.success).toHaveBeenCalledWith("개선 후보를 반려했습니다.");
  });

  it("개선 후보 상태 필터를 변경해 목록을 다시 조회한다", async () => {
    renderPage();

    await openCandidateTab();
    fireEvent.change(await screen.findByLabelText("개선 후보 상태 필터"), {
      target: { value: "READY_FOR_REVIEW" },
    });

    await waitFor(() => {
      expect(
        mockedSimulationApi.listImprovementCandidates,
      ).toHaveBeenCalledWith(1, {
        status: "READY_FOR_REVIEW",
        page: 0,
        size: 20,
      });
    });
  });
});
