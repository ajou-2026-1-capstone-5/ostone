package com.init.domainpack.application;

import com.init.domainpack.domain.model.PolicyDefinition;
import java.time.OffsetDateTime;

public record PolicyDefinitionResponse(
    Long id,
    Long domainPackVersionId,
    String policyCode,
    String name,
    String description,
    String severity,
    String conditionJson,
    String actionJson,
    String evidenceJson,
    String metaJson,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static PolicyDefinitionResponse from(PolicyDefinition policy) {
    return new PolicyDefinitionResponse(
        policy.getId(),
        policy.getDomainPackVersionId(),
        policy.getPolicyCode(),
        policy.getName(),
        policy.getDescription(),
        policy.getSeverity(),
        policy.getConditionJson(),
        policy.getActionJson(),
        policy.getEvidenceJson(),
        policy.getMetaJson(),
        policy.getStatus(),
        policy.getCreatedAt(),
        policy.getUpdatedAt());
  }
}
