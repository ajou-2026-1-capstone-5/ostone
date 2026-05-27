package com.init.chatdemo.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record SendDemoChatMessageRequest(@NotBlank String content) {}
