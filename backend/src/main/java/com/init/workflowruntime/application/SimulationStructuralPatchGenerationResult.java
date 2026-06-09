package com.init.workflowruntime.application;

/**
 * 구조적 패치 생성 결과. {@code SUCCESS}일 때만 {@code patchJson}이 #879 검증을 통과한 구조적 패치 JSON이며, 그 외에는 후보에 기록할 생성
 * 실패 상태와 사람이 읽을 수 있는 {@code summary}/{@code message}를 담는다.
 */
public record SimulationStructuralPatchGenerationResult(
    SimulationStructuralPatchGenerationStatus status,
    String patchJson,
    String summary,
    String message) {

  public static SimulationStructuralPatchGenerationResult success(String patchJson) {
    return new SimulationStructuralPatchGenerationResult(
        SimulationStructuralPatchGenerationStatus.SUCCESS, patchJson, null, null);
  }

  public static SimulationStructuralPatchGenerationResult needsHumanTarget(String summary) {
    return new SimulationStructuralPatchGenerationResult(
        SimulationStructuralPatchGenerationStatus.NEEDS_HUMAN_TARGET,
        null,
        summary == null || summary.isBlank() ? "사람이 변경 대상을 직접 지정해야 합니다." : summary.strip(),
        null);
  }

  public static SimulationStructuralPatchGenerationResult invalidOutput(String message) {
    return new SimulationStructuralPatchGenerationResult(
        SimulationStructuralPatchGenerationStatus.INVALID_OUTPUT,
        null,
        "구조적 패치를 자동으로 생성하지 못했습니다.",
        message);
  }

  public static SimulationStructuralPatchGenerationResult generationError(String message) {
    return new SimulationStructuralPatchGenerationResult(
        SimulationStructuralPatchGenerationStatus.GENERATION_ERROR,
        null,
        "구조적 패치 생성 중 오류가 발생했습니다.",
        message);
  }

  public boolean isSuccess() {
    return status == SimulationStructuralPatchGenerationStatus.SUCCESS;
  }
}
