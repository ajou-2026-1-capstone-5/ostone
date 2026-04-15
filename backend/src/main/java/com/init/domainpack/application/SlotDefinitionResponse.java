package com.init.domainpack.application;

import com.init.domainpack.domain.model.SlotDefinition;
import java.time.OffsetDateTime;

public record SlotDefinitionResponse(
    Long id,
    Long domainPackVersionId,
    String slotCode,
    String name,
    String description,
    String dataType,
    Boolean isSensitive,
    String validationRuleJson,
    String defaultValueJson,
    String metaJson,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static SlotDefinitionResponse from(SlotDefinition slot) {
    return new SlotDefinitionResponse(
        slot.getId(),
        slot.getDomainPackVersionId(),
        slot.getSlotCode(),
        slot.getName(),
        slot.getDescription(),
        slot.getDataType(),
        slot.getIsSensitive(),
        slot.getValidationRuleJson(),
        slot.getDefaultValueJson(),
        slot.getMetaJson(),
        slot.getStatus(),
        slot.getCreatedAt(),
        slot.getUpdatedAt());
  }
}
