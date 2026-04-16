package com.init.domainpack.application;

public record UpdateRiskCommand(
    Long workspaceId,
    Long packId,
    Long versionId,
    Long riskId,
    Long requesterId,
    String name,
    String description,
    String riskLevel,
    String triggerConditionJson,
    String handlingActionJson,
    String evidenceJson,
    String metaJson) {}
