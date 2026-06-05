package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotNull;

public record ReplaySimulationGoldenCaseRequest(@NotNull Long domainPackVersionId) {}
