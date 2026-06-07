package com.init.workspace.application;

public record WorkspaceDashboardHealthResult(
    WorkspaceDashboardKnowledgePackResult activeKnowledgePack,
    WorkspaceDashboardLogUploadResult lastLogUpload,
    WorkspaceDashboardGenerationResult lastKnowledgePackGeneration,
    long pendingReviewCount,
    Long latestOpenReviewPipelineJobId) {}
