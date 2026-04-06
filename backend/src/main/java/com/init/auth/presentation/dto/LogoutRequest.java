package com.init.auth.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LogoutRequest(
    @NotBlank(message = "리프레시 토큰은 필수입니다.")
        @Size(max = 4096, message = "리프레시 토큰은 4096자를 초과할 수 없습니다.")
        String refreshToken) {}
