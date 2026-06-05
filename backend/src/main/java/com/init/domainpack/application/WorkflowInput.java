package com.init.domainpack.application;

record WorkflowInput(
    String workflowCode,
    String name,
    String description,
    String graphJson,
    String initialState,
    String terminalStatesJson,
    String evidenceJson,
    String metaJson,
    String intentCode,
    Boolean isPrimary,
    String routeConditionJson) {}
