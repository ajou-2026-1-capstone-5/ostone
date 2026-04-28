package com.init.pipelinejob.application;

import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.PolicyDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.RiskDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.SlotDraft;
import com.init.domainpack.application.AddWorkflowDraftToVersionCommand.WorkflowDraft;
import java.util.List;

public record ReceiveWorkflowDraftCallbackCommand(
    Long jobId,
    String providedWebhookSecret,
    String externalEventId,
    Long domainPackVersionId,
    List<SlotDraft> slots,
    List<PolicyDraft> policies,
    List<RiskDraft> risks,
    List<WorkflowDraft> workflows,
    List<IntentSlotBindingDraft> intentSlotBindings,
    List<IntentWorkflowBindingDraft> intentWorkflowBindings,
    String requestHeadersJson,
    String requestBodyJson) {}
