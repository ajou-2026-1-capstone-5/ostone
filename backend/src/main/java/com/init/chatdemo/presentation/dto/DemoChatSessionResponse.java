package com.init.chatdemo.presentation.dto;

public record DemoChatSessionResponse(
    String id, String status, String startedAt, String completedAt) {}
