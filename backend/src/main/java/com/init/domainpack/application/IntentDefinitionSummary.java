package com.init.domainpack.application;

import com.init.domainpack.domain.model.IntentDefinition;
import java.time.OffsetDateTime;

public record IntentDefinitionSummary(
    Long id,
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    Long parentIntentId,
    String status,
    String sourceClusterRef,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static IntentDefinitionSummary from(IntentDefinition entity) {
    return new IntentDefinitionSummary(
        entity.getId(),
        entity.getIntentCode(),
        entity.getName(),
        entity.getDescription(),
        entity.getTaxonomyLevel(),
        entity.getParentIntentId(),
        entity.getStatus(),
        entity.getSourceClusterRef(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }
}
