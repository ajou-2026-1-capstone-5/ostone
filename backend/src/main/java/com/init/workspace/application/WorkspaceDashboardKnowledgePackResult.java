package com.init.workspace.application;

import java.time.OffsetDateTime;

public record WorkspaceDashboardKnowledgePackResult(
    Long packId,
    String packName,
    Long versionId,
    Integer versionNo,
    OffsetDateTime publishedAt,
    OffsetDateTime createdAt,
    Long sourcePipelineJobId) {}
