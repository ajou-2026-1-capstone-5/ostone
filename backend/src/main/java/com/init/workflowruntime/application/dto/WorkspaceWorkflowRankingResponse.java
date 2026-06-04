package com.init.workflowruntime.application.dto;

import java.time.OffsetDateTime;
import java.util.List;

public record WorkspaceWorkflowRankingResponse(
    Long workspaceId,
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    long totalConsultationCount,
    List<WorkspaceWorkflowRankingItemResponse> rankings,
    List<WorkspaceWorkflowRankingItemResponse> topRankings) {}
