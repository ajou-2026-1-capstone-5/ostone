package com.init.workflowruntime.application.dto;

import java.util.List;

public record SimulationGoldenCasePageResponse(
    List<SimulationGoldenCaseResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {}
