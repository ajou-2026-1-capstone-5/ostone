package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateSlotRequest(
    @NotBlank(message = "name은 필수 항목입니다.") String name,
    String description,
    Boolean isSensitive,
    String validationRuleJson,
    String defaultValueJson,
    String metaJson) {}
