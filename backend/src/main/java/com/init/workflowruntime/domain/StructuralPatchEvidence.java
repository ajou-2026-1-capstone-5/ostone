package com.init.workflowruntime.domain;

/** 구조적 패치를 뒷받침하는 시뮬레이션 근거. id 참조는 선택이지만, 리뷰 UI에서 사람이 읽을 수 있도록 {@code failureSummary}는 필수다. */
public record StructuralPatchEvidence(
    Long feedbackId,
    Long simulationSessionId,
    Long goldenCaseId,
    Long replayResultId,
    String failureSummary) {

  public StructuralPatchEvidence {
    if (failureSummary == null || failureSummary.isBlank()) {
      throw new InvalidStructuralPatchException("evidence.failureSummary는 필수입니다.");
    }
    failureSummary = failureSummary.strip();
  }
}
