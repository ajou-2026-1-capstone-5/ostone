package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;

public record ConsultationMetricsSessionFact(
    Long sessionId,
    OffsetDateTime startedAt,
    OffsetDateTime firstCustomerAt,
    OffsetDateTime firstResponseAt,
    OffsetDateTime firstLlmResponseAt,
    OffsetDateTime firstHumanResponseAt,
    boolean startedInPeriod,
    boolean handledInPeriod,
    boolean unresolvedInPeriod,
    boolean hasLlmMessage,
    boolean hasHumanMessage,
    boolean handoffSelected,
    boolean workflowMatched,
    boolean intentClassified,
    boolean lowConfidence,
    boolean unmatched,
    boolean coverageLogAvailable) {}
