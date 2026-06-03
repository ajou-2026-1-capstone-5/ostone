package com.init.shared.presentation.dto;

public record QuotaExceededErrorResponse(
    String code, String message, String resource, int limit, long used) {}
