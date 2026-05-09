package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.Size;

public record CreateRestoreDraftRequest(
    @Size(max = 1000, message = "reason은 1000자 이하여야 합니다.") String reason) {}
