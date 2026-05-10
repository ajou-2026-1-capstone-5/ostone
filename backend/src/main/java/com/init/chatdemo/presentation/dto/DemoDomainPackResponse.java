package com.init.chatdemo.presentation.dto;

import java.util.List;

public record DemoDomainPackResponse(
    String id,
    String name,
    String version,
    String status,
    List<DemoIntentResponse> intents,
    List<DemoPolicyResponse> policies,
    List<DemoRiskResponse> risks) {}
