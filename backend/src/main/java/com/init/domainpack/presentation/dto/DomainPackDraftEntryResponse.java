package com.init.domainpack.presentation.dto;

public record DomainPackDraftEntryResponse(
    Long workspaceId, Long packId, Long versionId, String packName, Integer versionNo) {}
