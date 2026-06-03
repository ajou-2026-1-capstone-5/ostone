package com.init.workflowruntime.application.dto;

import java.util.List;

public record SimulationSessionPageResponse(
    List<ChatSessionResponse> content,
    int page,
    int size,
    long totalElements,
    int totalPages) {}
