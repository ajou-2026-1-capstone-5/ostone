package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSlotStatusRequest(@NotBlank(message = "status는 필수 항목입니다.") String status) {}
