package com.init.domainpack.application;

record PolicyInput(
    String policyCode,
    String name,
    String description,
    String severity,
    String conditionJson,
    String actionJson,
    String evidenceJson,
    String metaJson) {}
