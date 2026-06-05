package com.init.workflowruntime.application.dto;

import java.util.List;

public record MessageDomainPackElementsResponse(
    Long sessionId,
    Long messageId,
    Long workspaceId,
    Long domainPackVersionId,
    Long executionId,
    String currentState,
    List<SlotElement> slots,
    List<PolicyElement> policies,
    List<RiskElement> risks) {

  public record SlotElement(
      Long id, String code, String name, boolean extracted, String value, String detailPath) {}

  public record PolicyElement(
      Long id,
      String code,
      String name,
      boolean extracted,
      boolean matched,
      String reason,
      String nodeId,
      String detailPath) {}

  public record RiskElement(
      Long id, String code, String name, boolean extracted, String level, String detailPath) {}
}
