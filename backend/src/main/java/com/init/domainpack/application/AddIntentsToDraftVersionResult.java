package com.init.domainpack.application;

public record AddIntentsToDraftVersionResult(
    Long domainPackVersionId,
    Long domainPackId,
    int addedIntentCount,
    int skippedIntentCount,
    int totalIntentCount) {}
