package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateIntentStatusRequest(@NotBlank(message = "status는 필수 항목입니다.") String status) {}