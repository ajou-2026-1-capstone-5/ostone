package com.init.chatdemo.presentation.dto;

import java.util.List;

public record DemoChatSessionEndpointResponse(
    DemoChatSessionResponse chatSession, List<DemoMessageResponse> messages) {}
