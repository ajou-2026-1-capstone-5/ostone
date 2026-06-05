package com.init.domainpack.application;

record SlotInput(
    String slotCode,
    String name,
    String description,
    String dataType,
    Boolean isSensitive,
    String validationRuleJson,
    String defaultValueJson,
    String metaJson) {}
