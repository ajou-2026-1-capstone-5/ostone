package com.init.workflowruntime.application.dto;

import jakarta.validation.constraints.NotBlank;

public record SelectIntentRequest(@NotBlank String intentCode) {}
