package com.init.domainpack.application;

import com.init.domainpack.domain.model.RiskDefinition;
import java.time.OffsetDateTime;

public record RiskDefinitionSummary(
    Long id,
    Long domainPackVersionId,
    String riskCode,
    String name,
    String description,
    String riskLevel,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static RiskDefinitionSummary from(RiskDefinition risk) {
    return new RiskDefinitionSummary(
        risk.getId(),
        risk.getDomainPackVersionId(),
        risk.getRiskCode(),
        risk.getName(),
        risk.getDescription(),
        risk.getRiskLevel(),
        risk.getStatus(),
        risk.getCreatedAt(),
        risk.getUpdatedAt());
  }
}
