package com.init.workflowruntime.application.matching;

public record WorkflowMatchingProfileWrite(
    Long domainPackVersionId,
    Long workflowDefinitionId,
    Long intentDefinitionId,
    String profileVersion,
    String profileTextHash,
    String profileText,
    String embeddingLiteral,
    String embeddingProvider,
    String embeddingModel,
    String embeddingRegion,
    String embeddingInputType,
    String qualityJson,
    String sourceJson) {}
