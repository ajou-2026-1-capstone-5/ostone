package com.init.domainpack.application;

import java.util.List;

record DraftComponentsInput(
    List<SlotInput> slots,
    List<PolicyInput> policies,
    List<RiskInput> risks,
    List<WorkflowInput> workflows,
    List<IntentSlotBindingInput> intentSlotBindings) {}
