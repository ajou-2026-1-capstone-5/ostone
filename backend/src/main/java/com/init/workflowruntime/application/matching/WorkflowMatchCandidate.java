package com.init.workflowruntime.application.matching;

public record WorkflowMatchCandidate(
    Long workflowDefinitionId,
    Long intentDefinitionId,
    String intentCode,
    String intentName,
    String workflowCode,
    String workflowName,
    String profileVersion,
    double confidence,
    double semanticScore,
    double routeScore,
    double lexicalScore,
    double lexicalSearchScore,
    double qualityScore,
    double operationalPriorScore,
    boolean autoRunEligible,
    boolean blocked,
    String autoRunBlockReason,
    String confusionType) {}
