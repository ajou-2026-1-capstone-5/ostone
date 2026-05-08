package com.init.pipelinejob.application;

public record AddIntentsToDraftVersionPortResult(
    Long domainPackVersionId,
    Long domainPackId,
    int addedIntentCount,
    int skippedIntentCount,
    int totalIntentCount) {}
