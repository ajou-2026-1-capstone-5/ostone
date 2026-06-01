package com.init.workflowruntime.application.matching;

public record WorkflowMatchingProfileCandidate(
    Long profileId,
    Long workflowDefinitionId,
    Long intentDefinitionId,
    String workflowCode,
    String workflowName,
    String intentCode,
    String intentName,
    String intentEntryConditionJson,
    String profileVersion,
    String profileText,
    String routeConditionJson,
    String workflowMetaJson,
    String qualityJson,
    String sourceJson,
    String embeddingProvider,
    String embeddingModel,
    String embeddingRegion,
    double semanticScore,
    double lexicalSearchScore,
    double operationalPriorScore) {}
