import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { SimulationImprovementCandidate } from "@/features/simulation";
import {
  candidate,
  mockedSimulationApi,
  openCandidateTab,
  renderPage,
  toast,
} from "./WorkspaceSimulationPage.test-helper";

// structural 후보 픽스처 팩토리
// patchValidationStatus="VALID" + operations 포함 = 구조 패치 검토 UI 경로
function makeStructuralCandidate(
  overrides: Partial<SimulationImprovementCandidate> = {},
): SimulationImprovementCandidate {
  return {
    ...candidate,
    id: 2000,
    status: "READY_FOR_REVIEW",
    patchValidationStatus: "VALID",
    patchSummary: "주문번호 슬롯 필수화",
    patchValidationErrors: [],
    operations: [
      {
        operationType: "MARK_SLOT_REQUIRED",
        kind: "ELEMENT",
        targetCategory: "SLOT",
        targetCode: "orderNo",
        targetId: 55,
        value: null,
        nodeId: null,
        nodeType: null,
        slotCode: "orderNo",
        prompt: null,
        from: null,
        to: null,
        condition: null,
        reason: "주문번호 없이 환불 처리 불가",
        targetComplete: true,
      },
    ],
    draftPatchJson: JSON.stringify({ schemaVersion: "v1", operations: [] }),
    reviewSessionId: 200,
    reviewTaskId: 300,
    ...overrides,
  };
}

function makeWorkflowStructuralCandidate(): SimulationImprovementCandidate {
  return makeStructuralCandidate({
    id: 2001,
    patchSummary: "결제 확인 노드 추가",
    operations: [
      {
        operationType: "ADD_WORKFLOW_NODE",
        kind: "WORKFLOW_NODE",
        targetCategory: null,
        targetCode: null,
        targetId: null,
        value: null,
        nodeId: "node-payment-check",
        nodeType: "ASK_SLOT",
        slotCode: null,
        prompt: "결제 방법을 알려주세요.",
        from: null,
        to: null,
        condition: null,
        reason: "결제 정보 필요",
        targetComplete: true,
      },
    ],
  });
}

function candidatePage(items: SimulationImprovementCandidate[]) {
  return {
    content: items,
    page: 0,
    size: 20,
    totalElements: items.length,
    totalPages: 1,
  };
}

describe("WorkspaceSimulationPage structural 후보 검토", () => {
  it("structural 후보 카드가 patchSummary, 검증 통과 뱃지, operation diff를 렌더한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([makeStructuralCandidate()]),
    );
    renderPage();

    await openCandidateTab();

    // 패치 요약
    expect(await screen.findByText("주문번호 슬롯 필수화")).toBeInTheDocument();

    // 검증 통과 뱃지
    expect(screen.getByText("검증 통과")).toBeInTheDocument();

    // operation diff — operationLabel 확인
    expect(screen.getByText("슬롯 필수화")).toBeInTheDocument();

    // Before/After 라벨
    expect(screen.getAllByText("Before").length).toBeGreaterThan(0);
    expect(screen.getAllByText("After").length).toBeGreaterThan(0);
  });

  it("WORKFLOW_NODE op 포함 structural 후보는 '워크플로우 구조 변경' 뱃지를 표시한다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([makeWorkflowStructuralCandidate()]),
    );
    renderPage();

    await openCandidateTab();

    expect(await screen.findByText("워크플로우 구조 변경")).toBeInTheDocument();
  });

  it("구조 패치 검토 확인 전 승인 버튼이 disabled다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([makeStructuralCandidate()]),
    );
    renderPage();

    await openCandidateTab();
    await screen.findByText("검증 통과");

    const approveButton = screen.getByRole("button", { name: "승인" });
    expect(approveButton).toBeDisabled();
  });

  it("구조 패치 검토 확인 체크 후 승인 버튼이 활성화된다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([makeStructuralCandidate()]),
    );
    renderPage();

    await openCandidateTab();
    await screen.findByText("검증 통과");

    const approveButton = screen.getByRole("button", { name: "승인" });
    expect(approveButton).toBeDisabled();

    // 구조 변경 검토 확인 체크박스 클릭
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "승인" })).not.toBeDisabled();
    });
  });

  it("patchValidationStatus=INVALID 후보는 검증 실패 뱃지, 오류 목록을 표시하고 승인 버튼이 disabled다", async () => {
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([
        makeStructuralCandidate({
          patchValidationStatus: "INVALID",
          patchValidationErrors: ["operationType 필드 누락", "targetId가 양수가 아님"],
          operations: [],
        }),
      ]),
    );
    renderPage();

    await openCandidateTab();

    // 검증 실패 뱃지
    expect(await screen.findByText("검증 실패")).toBeInTheDocument();

    // 오류 목록 (aria-label="검증 오류 목록")
    const errorList = await screen.findByRole("list", { name: "검증 오류 목록" });
    expect(errorList).toBeInTheDocument();
    expect(errorList).toHaveTextContent("operationType 필드 누락");
    expect(errorList).toHaveTextContent("targetId가 양수가 아님");

    // 승인 버튼 disabled
    expect(screen.getByRole("button", { name: "승인" })).toBeDisabled();
  });

  it("structural 후보 승인 후 APPLIED 상태와 리플레이 CTA를 표시한다", async () => {
    const approvedCandidate = {
      ...makeStructuralCandidate(),
      status: "APPLIED" as const,
      appliedDomainPackVersionId: 202,
    };
    mockedSimulationApi.listImprovementCandidates
      .mockResolvedValueOnce(candidatePage([makeStructuralCandidate()]))
      // 승인 후 목록 새로고침 시 APPLIED 상태 반환
      .mockResolvedValue(candidatePage([approvedCandidate]));
    mockedSimulationApi.approveImprovementCandidate.mockResolvedValue(approvedCandidate);
    renderPage();

    await openCandidateTab();
    await screen.findByText("검증 통과");

    // 체크박스 체크
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "승인" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(mockedSimulationApi.approveImprovementCandidate).toHaveBeenCalledWith(
        1,
        2000,
        expect.any(Object),
      );
    });

    // 승인 후 candidateApprovalNotice (<output>) 또는 ApprovedReplayCta (<div role=status>) 중
    // 버전 정보("#202")가 포함된 요소가 화면에 나타남
    const statusEls = await screen.findAllByRole("status");
    const hasVersionText = statusEls.some((el) => el.textContent?.includes("202"));
    expect(hasVersionText).toBe(true);

    // 토스트 성공
    expect(toast.success).toHaveBeenCalled();
  });

  it("appliedDomainPackVersionId=null APPLIED 후보는 '적용 버전 응답 대기' 메시지를 표시한다", async () => {
    const approvedCandidateNullVersion = {
      ...makeStructuralCandidate(),
      status: "APPLIED" as const,
      appliedDomainPackVersionId: null,
    };
    mockedSimulationApi.listImprovementCandidates
      .mockResolvedValueOnce(candidatePage([makeStructuralCandidate()]))
      // 승인 후 목록 새로고침 시 APPLIED 상태 (버전 없음) 반환
      .mockResolvedValue(candidatePage([approvedCandidateNullVersion]));
    mockedSimulationApi.approveImprovementCandidate.mockResolvedValue(approvedCandidateNullVersion);
    renderPage();

    await openCandidateTab();
    await screen.findByText("검증 통과");

    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "승인" })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "승인" }));

    await waitFor(() => {
      expect(mockedSimulationApi.approveImprovementCandidate).toHaveBeenCalled();
    });

    // candidateApprovalGuide()는 appliedDomainPackVersionId=null 시 "적용 version 응답 대기" 반환
    // <output> 또는 role=status 중 하나에 해당 텍스트가 나타남
    const statusEls = await screen.findAllByRole("status");
    const hasWaitingText = statusEls.some((el) =>
      el.textContent?.includes("적용 version 응답 대기"),
    );
    expect(hasWaitingText).toBe(true);
  });

  it("patchValidationStatus=NONE 레거시 후보는 기존 Draft patch 검토 UI로 렌더된다", async () => {
    // NONE 상태 후보 = legacy 경로 → 기존 CandidatePatchReview 사용
    mockedSimulationApi.listImprovementCandidates.mockResolvedValue(
      candidatePage([
        {
          ...candidate,
          id: 3000,
          status: "READY_FOR_REVIEW",
          patchValidationStatus: "NONE",
          patchSummary: null,
          patchValidationErrors: [],
          operations: [],
          draftPatchJson: "{}",
          reviewSessionId: 200,
          reviewTaskId: 300,
        },
      ]),
    );
    renderPage();

    await openCandidateTab();

    // 기존 레거시 UI 노출 확인 — 새 structural 뱃지("검증 통과"/"검증 실패")가 없어야 함
    expect(await screen.findByText("Draft patch 검토")).toBeInTheDocument();
    expect(screen.queryByText("검증 통과")).not.toBeInTheDocument();
    expect(screen.queryByText("검증 실패")).not.toBeInTheDocument();
    expect(screen.queryByText("워크플로우 구조 변경")).not.toBeInTheDocument();
  });
});
