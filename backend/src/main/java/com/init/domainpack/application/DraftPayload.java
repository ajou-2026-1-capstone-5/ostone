package com.init.domainpack.application;

import java.util.List;

record DraftPayload(
    List<IntentDraft> intents,
    List<SlotInput> slots,
    List<IntentSlotBindingInput> intentSlotBindings,
    List<PolicyInput> policies,
    List<RiskInput> risks,
    List<WorkflowInput> workflows) {}
