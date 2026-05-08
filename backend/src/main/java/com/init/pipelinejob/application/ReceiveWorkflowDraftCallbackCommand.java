package com.init.pipelinejob.application;

import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentSlotBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.IntentWorkflowBindingDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.PolicyDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.RiskDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.SlotDraft;
import com.init.pipelinejob.application.AddWorkflowDraftPortCommand.WorkflowDraft;
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
