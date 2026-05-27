package com.init.chatdemo.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record CreateDemoChatSessionRequest(@NotBlank String customerName) {}
