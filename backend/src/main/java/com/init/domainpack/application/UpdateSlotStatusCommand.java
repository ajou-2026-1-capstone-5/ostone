package com.init.domainpack.application;

public record UpdateSlotStatusCommand(
    Long workspaceId, Long packId, Long versionId, Long slotId, Long requesterId, String status) {}
