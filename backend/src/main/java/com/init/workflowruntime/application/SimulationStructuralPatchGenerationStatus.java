package com.init.workflowruntime.application;

/** LLM 기반 구조적 패치 생성 결과 상태. */
public enum SimulationStructuralPatchGenerationStatus {
  /** 검증된 구조적 패치를 생성했다. */
  SUCCESS,
  /** 모델이 안전하게 대상을 특정할 수 없어 사람의 판단이 필요하다. */
  NEEDS_HUMAN_TARGET,
  /** 출력이 파싱/검증되지 않았다(fail closed). */
  INVALID_OUTPUT,
  /** LLM 호출 자체가 실패했다. */
  GENERATION_ERROR
}
