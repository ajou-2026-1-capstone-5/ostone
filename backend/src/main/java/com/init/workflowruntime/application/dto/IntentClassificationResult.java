package com.init.workflowruntime.application.dto;

import java.util.List;

public record IntentClassificationResult(
    String status,
    String intentCode,
    String workflowCode,
    double confidence,
    String confirmationQuestion,
    String message,
    List<IntentCandidate> candidates) {

  public static IntentClassificationResult confident(
      String intentCode, double confidence, List<IntentCandidate> candidates) {
    return confident(intentCode, null, confidence, candidates);
  }

  public static IntentClassificationResult confident(
      String intentCode, String workflowCode, double confidence, List<IntentCandidate> candidates) {
    return new IntentClassificationResult(
        "CONFIDENT", intentCode, workflowCode, confidence, null, null, copy(candidates));
  }

  public static IntentClassificationResult ambiguous(
      String confirmationQuestion, List<IntentCandidate> candidates) {
    return new IntentClassificationResult(
        "AMBIGUOUS", null, null, 0.0, confirmationQuestion, null, copy(candidates));
  }

  public static IntentClassificationResult unknown(String message) {
    return new IntentClassificationResult("UNKNOWN", null, null, 0.0, null, message, List.of());
  }

  private static List<IntentCandidate> copy(List<IntentCandidate> candidates) {
    return candidates == null ? List.of() : List.copyOf(candidates);
  }
}
