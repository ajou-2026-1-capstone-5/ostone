package com.init.workspace.application;

import java.time.LocalDate;

public record GetWorkspaceDashboardActionRecommendationsCommand(
    Long workspaceId, Long userId, LocalDate fromDate, LocalDate toDate) {}
