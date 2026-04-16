package com.init.domainpack.application;

import com.init.domainpack.domain.model.RiskDefinition;
import java.time.OffsetDateTime;

public record RiskDefinitionResponse(
    Long id,
    Long domainPackVersionId,
    String riskCode,
    String name,
    String description,
    String riskLevel,
    String triggerConditionJson,
    String handlingActionJson,
    String evidenceJson,
    String metaJson,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static RiskDefinitionResponse from(RiskDefinition risk) {
    return new RiskDefinitionResponse(
        risk.getId(),
        risk.getDomainPackVersionId(),
        risk.getRiskCode(),
        risk.getName(),
        risk.getDescription(),
        risk.getRiskLevel(),
        risk.getTriggerConditionJson(),
        risk.getHandlingActionJson(),
        risk.getEvidenceJson(),
        risk.getMetaJson(),
        risk.getStatus(),
        risk.getCreatedAt(),
        risk.getUpdatedAt());
  }
}
