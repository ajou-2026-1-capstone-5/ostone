package com.init.workflowruntime.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateUserChatSessionRequest(@NotBlank String customerName) {}
