package com.init.workflowruntime.domain;

/** 후보 draft patch JSON을 read-side에서 정규화·검증한 결과 상태. */
public enum SimulationPatchValidationStatus {
  /** {@code simulation-structural-patch.v1} 스키마로 파싱·검증을 통과한 구조 패치. */
  VALID,
  /** 구조 패치 스키마이지만 파싱/검증에 실패한 패치(프론트는 오류만 노출). */
  INVALID,
  /** 구버전 {@code simulation-candidate-draft-patch.v1} 패치(프론트가 기존 방식으로 렌더). */
  LEGACY,
  /** 정규화할 구조 패치가 없는 상태(빈 object/배열/null). */
  NONE
}
