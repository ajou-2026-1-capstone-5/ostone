import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { SimulationImprovementCandidate } from "@/features/simulation";
import { StructuralPatchReview } from "./StructuralPatchReviewPanel";

// ---- 목 팩토리 ----

function makeCandidate(
  overrides: Partial<SimulationImprovementCandidate> = {},
): SimulationImprovementCandidate {
  return {
    id: 1000,
    workspaceId: 1,
    domainPackVersionId: 101,
    feedbackId: 900,
    sessionId: 10,
    chatMessageId: null,
    candidateType: "SLOT_QUESTION",
    targetElementType: "SLOT",
    targetElementId: null,
    targetElementKey: null,
    beforeSummary: "before",
    afterSummary: "after",
    evidenceSummary: "근거 요약",
    reviewSessionId: null,
    reviewTaskId: null,
    appliedDomainPackVersionId: null,
    draftPatchJson: "{}",
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
    status: "DRAFT",
    createdBy: 7,
    createdAt: "2026-06-04T10:45:00Z",
    updatedAt: "2026-06-04T10:45:00Z",
    patchSchemaVersion: null,
    patchSummary: null,
    patchValidationStatus: "NONE",
    patchValidationErrors: [],
    operations: [],
    ...overrides,
  };
}

function makeValidCandidate(
  overrides: Partial<SimulationImprovementCandidate> = {},
): SimulationImprovementCandidate {
  return makeCandidate({
    status: "READY_FOR_REVIEW",
    patchValidationStatus: "VALID",
    patchSummary: "슬롯 필수화 패치",
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
    draftPatchJson: '{"schemaVersion":"v1"}',
    ...overrides,
  });
}

function renderPanel(
  candidate: SimulationImprovementCandidate,
  opts: {
    confirmed?: boolean;
    onToggleConfirm?: () => void;
    onReplayAppliedVersion?: (versionId: number) => void;
    legacyFallback?: React.ReactNode;
  } = {},
) {
  const {
    confirmed = false,
    onToggleConfirm = vi.fn(),
    onReplayAppliedVersion,
    legacyFallback = <div>레거시 패치 UI</div>,
  } = opts;

  render(
    <StructuralPatchReview
      candidate={candidate}
      confirmed={confirmed}
      onToggleConfirm={onToggleConfirm}
      legacyFallback={legacyFallback}
      onReplayAppliedVersion={onReplayAppliedVersion}
    />,
  );
}

// ---- candidateStatusBadgeLabel 분기 ----

describe("StructuralPatchReview — 상태 뱃지 렌더", () => {
  it("DRAFT 상태 후보는 '초안 패치' 뱃지를 표시한다", () => {
    renderPanel(makeValidCandidate({ status: "DRAFT" }));
    expect(screen.getByText("초안 패치")).toBeInTheDocument();
  });

  it("APPLIED + appliedDomainPackVersionId 있음은 '초안 버전 반영됨' 뱃지를 표시한다", () => {
    renderPanel(
      makeValidCandidate({
        status: "APPLIED",
        appliedDomainPackVersionId: 202,
      }),
    );
    expect(screen.getByText("초안 버전 반영됨")).toBeInTheDocument();
  });

  it("APPLIED + appliedDomainPackVersionId=null은 '승인됨 · 적용 버전 응답 대기' 뱃지를 표시한다", () => {
    renderPanel(
      makeValidCandidate({
        status: "APPLIED",
        appliedDomainPackVersionId: null,
      }),
    );
    expect(screen.getByText("승인됨 · 적용 버전 응답 대기")).toBeInTheDocument();
  });
});

// ---- patchValidationBadgeLabel 분기 ----

describe("StructuralPatchReview — 패치 검증 뱃지 렌더", () => {
  it("patchValidationStatus=LEGACY 후보는 legacyFallback을 렌더하고 '레거시 패치' 뱃지를 표시하지 않는다", () => {
    renderPanel(makeCandidate({ patchValidationStatus: "LEGACY" }), {
      legacyFallback: <div>레거시 패치 UI</div>,
    });
    // legacy 경로는 legacyFallback을 그대로 렌더
    expect(screen.getByText("레거시 패치 UI")).toBeInTheDocument();
    // structural 패널 헤더가 없어야 함
    expect(screen.queryByLabelText("구조 패치 검토")).not.toBeInTheDocument();
  });

  it("patchValidationStatus=NONE 후보는 '패치 없음' 뱃지를 표시한다", () => {
    renderPanel(makeCandidate({ patchValidationStatus: "NONE" }));
    expect(screen.getByText("패치 없음")).toBeInTheDocument();
  });
});

// ---- INVALID 패널 렌더 ----

describe("StructuralPatchReview — INVALID 패널", () => {
  it("patchValidationStatus=INVALID는 '검증 실패' 뱃지와 검증 오류 목록을 렌더한다", () => {
    renderPanel(
      makeCandidate({
        patchValidationStatus: "INVALID",
        patchValidationErrors: ["operationType 필드 누락", "targetId가 양수가 아님"],
        status: "READY_FOR_REVIEW",
      }),
    );

    expect(screen.getByText("검증 실패")).toBeInTheDocument();
    const errorList = screen.getByRole("list", { name: "검증 오류 목록" });
    expect(errorList).toHaveTextContent("operationType 필드 누락");
    expect(errorList).toHaveTextContent("targetId가 양수가 아님");
  });

  it("patchValidationStatus=INVALID에서 패치 검증 실패 메시지를 렌더한다", () => {
    renderPanel(
      makeCandidate({
        patchValidationStatus: "INVALID",
        patchValidationErrors: ["오류 하나"],
      }),
    );

    expect(screen.getByText("패치 검증에 실패했습니다. 승인할 수 없습니다.")).toBeInTheDocument();
  });
});

// ---- ApprovedReplayCta 분기 ----

describe("StructuralPatchReview — ApprovedReplayCta", () => {
  it("APPLIED + versionId=null은 '적용 버전 응답을 기다리는 중' 메시지를 표시하고 리플레이 버튼이 없다", () => {
    const onReplay = vi.fn();
    renderPanel(
      makeValidCandidate({
        status: "APPLIED",
        appliedDomainPackVersionId: null,
      }),
      { confirmed: true, onReplayAppliedVersion: onReplay },
    );

    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toHaveTextContent("적용 버전 응답을 기다리는 중");
    expect(screen.queryByRole("button", { name: /리플레이/ })).not.toBeInTheDocument();
  });

  it("APPLIED + versionId 있음 + onReplay 있음은 리플레이 버튼을 표시하고 클릭 시 versionId로 호출한다", () => {
    const onReplay = vi.fn();
    renderPanel(
      makeValidCandidate({
        status: "APPLIED",
        appliedDomainPackVersionId: 303,
      }),
      { confirmed: true, onReplayAppliedVersion: onReplay },
    );

    expect(screen.getByRole("status")).toHaveTextContent("초안 버전 #303에 반영했습니다");

    const replayButton = screen.getByRole("button", { name: /리플레이/ });
    expect(replayButton).toBeInTheDocument();

    fireEvent.click(replayButton);
    expect(onReplay).toHaveBeenCalledWith(303);
  });

  it("APPLIED + versionId 있음 + onReplay=undefined는 리플레이 버튼을 표시하지 않는다", () => {
    renderPanel(
      makeValidCandidate({
        status: "APPLIED",
        appliedDomainPackVersionId: 404,
      }),
      { confirmed: true, onReplayAppliedVersion: undefined },
    );

    expect(screen.getByRole("status")).toHaveTextContent("초안 버전 #404에 반영했습니다");
    expect(screen.queryByRole("button", { name: /리플레이/ })).not.toBeInTheDocument();
  });
});

// ---- EvidencePanel reason 렌더 ----

describe("StructuralPatchReview — operation reason 렌더", () => {
  it("operation에 reason이 있으면 근거 텍스트를 diff 카드에 렌더한다", () => {
    renderPanel(
      makeValidCandidate({
        operations: [
          {
            operationType: "MARK_SLOT_REQUIRED",
            kind: "ELEMENT",
            targetCategory: null,
            targetCode: null,
            targetId: null,
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
      }),
    );

    expect(screen.getByText("주문번호 없이 환불 처리 불가")).toBeInTheDocument();
  });
});
