package com.init.workflowruntime.application.dto;

public record IntentCandidate(
    String intentCode, String name, double confidence, String workflowCode, String workflowName) {

  /** 워크플로우 식별 정보가 없는 intent 수준 후보(하위호환). */
  public IntentCandidate(String intentCode, String name, double confidence) {
    this(intentCode, name, confidence, null, null);
  }
}
