package com.init.chatdemo.presentation.dto;

import java.util.List;

public record DemoChatWorkflowResponse(
    DemoDomainPackResponse domainPack,
    DemoWorkflowResponse workflow,
    DemoChatSessionResponse chatSession,
    List<DemoMessageResponse> messages,
    DemoExecutionResponse execution,
    List<DemoDecisionLogResponse> decisionLogs) {}
