package com.init.domainpack.application;

record IntentSlotBindingInput(
    String intentCode,
    String slotCode,
    Boolean isRequired,
    Integer collectionOrder,
    String promptHint,
    String conditionJson) {}
