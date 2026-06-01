package com.init.workflowruntime.application.matching;

import java.util.List;

public record WorkflowMatchResult(
    String status,
    String message,
    String confirmationQuestion,
    List<WorkflowMatchCandidate> candidates) {

  public static WorkflowMatchResult confident(WorkflowMatchCandidate candidate) {
    return new WorkflowMatchResult("CONFIDENT", null, null, List.of(candidate));
  }

  public static WorkflowMatchResult ambiguous(
      String confirmationQuestion, List<WorkflowMatchCandidate> candidates) {
    return new WorkflowMatchResult(
        "AMBIGUOUS", null, confirmationQuestion, List.copyOf(candidates));
  }

  public static WorkflowMatchResult unknown(String message) {
    return new WorkflowMatchResult("UNKNOWN", message, null, List.of());
  }

  public static WorkflowMatchResult blocked(
      String message, List<WorkflowMatchCandidate> candidates) {
    return new WorkflowMatchResult("BLOCKED", message, null, List.copyOf(candidates));
  }

  public static WorkflowMatchResult unavailable() {
    return new WorkflowMatchResult("UNAVAILABLE", null, null, List.of());
  }
}
