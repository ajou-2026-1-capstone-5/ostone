package com.init.domainpack.application;

import com.init.domainpack.domain.model.SlotDefinition;
import java.time.OffsetDateTime;

public record SlotDefinitionSummary(
    Long id,
    Long domainPackVersionId,
    String slotCode,
    String name,
    String description,
    String dataType,
    Boolean isSensitive,
    String status,
    OffsetDateTime createdAt,
    OffsetDateTime updatedAt) {

  public static SlotDefinitionSummary from(SlotDefinition slot) {
    return new SlotDefinitionSummary(
        slot.getId(),
        slot.getDomainPackVersionId(),
        slot.getSlotCode(),
        slot.getName(),
        slot.getDescription(),
        slot.getDataType(),
        slot.getIsSensitive(),
        slot.getStatus(),
        slot.getCreatedAt(),
        slot.getUpdatedAt());
  }
}
