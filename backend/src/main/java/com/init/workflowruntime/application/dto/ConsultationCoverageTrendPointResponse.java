package com.init.workflowruntime.application.dto;

import java.time.LocalDate;

public record ConsultationCoverageTrendPointResponse(
    LocalDate date,
    long totalConsultationCount,
    long workflowMatchedCount,
    Double workflowMatchRate) {}
