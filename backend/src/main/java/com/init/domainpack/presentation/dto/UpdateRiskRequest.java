package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateRiskRequest(
    @NotBlank(message = "name은 필수 항목입니다.") String name,
    String description,
    String riskLevel,
    String triggerConditionJson,
    String handlingActionJson,
    String evidenceJson,
    String metaJson) {}
