package com.init.domainpack.application;

import com.init.domainpack.domain.model.IntentDefinition;
import java.time.OffsetDateTime;

public record IntentDefinitionStatusResponse(
    Long id,
    Long domainPackVersionId,
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static IntentDefinitionStatusResponse from(IntentDefinition intent) {
    return new IntentDefinitionStatusResponse(
        intent.getId(),
        intent.getDomainPackVersionId(),
        intent.getIntentCode(),
        intent.getName(),
        intent.getDescription(),
        intent.getTaxonomyLevel(),
        intent.getStatus(),
        intent.getCreatedAt(),
        intent.getUpdatedAt());
  }
}
