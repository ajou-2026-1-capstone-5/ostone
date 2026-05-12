package com.init.chatdemo.presentation.dto;

import java.util.List;

public record DemoWorkflowResponse(
    String id,
    String name,
    String description,
    List<String> states,
    List<DemoTransitionResponse> transitions) {}
