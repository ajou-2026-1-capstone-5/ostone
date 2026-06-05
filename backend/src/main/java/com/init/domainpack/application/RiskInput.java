package com.init.domainpack.application;

record RiskInput(
    String riskCode,
    String name,
    String description,
    String riskLevel,
    String triggerConditionJson,
    String handlingActionJson,
    String evidenceJson,
    String metaJson) {}
