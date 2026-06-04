package com.init.workspace.application;

import java.time.OffsetDateTime;
import java.util.List;

public record WorkspaceDashboardActionRecommendationsResult(
    Long workspaceId,
    OffsetDateTime periodStart,
    OffsetDateTime periodEnd,
    List<WorkspaceDashboardActionRecommendationResult> recommendations) {}
