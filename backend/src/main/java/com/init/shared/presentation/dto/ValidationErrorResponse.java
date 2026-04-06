package com.init.shared.presentation.dto;

import java.util.List;

public record ValidationErrorResponse(String code, List<String> errors) {}
