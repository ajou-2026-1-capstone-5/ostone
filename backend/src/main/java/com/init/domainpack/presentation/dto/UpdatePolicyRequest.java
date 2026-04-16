package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePolicyRequest(
    @NotBlank(message = "name은 필수 항목입니다.") String name,
    String description,
    String severity,
    String conditionJson,
    String actionJson,
    String evidenceJson,
    String metaJson) {}
