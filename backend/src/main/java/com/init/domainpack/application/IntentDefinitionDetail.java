package com.init.domainpack.application;

import com.init.domainpack.domain.model.IntentDefinition;
import java.time.OffsetDateTime;

public record IntentDefinitionDetail(
    Long id,
    String intentCode,
    String name,
    String description,
    Integer taxonomyLevel,
    Long parentIntentId,
    String status,
    String sourceClusterRef,
    String entryConditionJson,
    String evidenceJson,
    String metaJson,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static IntentDefinitionDetail from(IntentDefinition entity) {
    return new IntentDefinitionDetail(
        entity.getId(),
        entity.getIntentCode(),
        entity.getName(),
        entity.getDescription(),
        entity.getTaxonomyLevel(),
        entity.getParentIntentId(),
        entity.getStatus(),
        entity.getSourceClusterRef(),
        entity.getEntryConditionJson(),
        entity.getEvidenceJson(),
        entity.getMetaJson(),
        entity.getCreatedAt(),
        entity.getUpdatedAt());
  }
}
