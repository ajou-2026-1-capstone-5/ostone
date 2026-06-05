package com.init.workflowruntime.application.dto;

import java.util.List;

public record SimulationGoldenCaseReplayResultPageResponse(
    List<SimulationGoldenCaseReplayResultResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {}
