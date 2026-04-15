package com.init.domainpack.application;

public record UpdateSlotCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long slotId,
    Long requesterId,
    String name,
    String description,
    Boolean isSensitive,
    String validationRuleJson,
    String defaultValueJson,
    String metaJson) {}
