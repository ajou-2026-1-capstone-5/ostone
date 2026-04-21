package com.init.domainpack.application;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.time.OffsetDateTime;

public record PolicyDefinitionSummary(
    Long id,
    Long domainPackVersionId,
    String policyCode,
    String name,
    String description,
    String severity,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static PolicyDefinitionSummary from(PolicyDefinition policy) {
    return new PolicyDefinitionSummary(
        policy.getId(),
        policy.getDomainPackVersionId(),
        policy.getPolicyCode(),
        policy.getName(),
        policy.getDescription(),
        policy.getSeverity(),
        policy.getStatus(),
        policy.getCreatedAt(),
        policy.getUpdatedAt());
  }
}
