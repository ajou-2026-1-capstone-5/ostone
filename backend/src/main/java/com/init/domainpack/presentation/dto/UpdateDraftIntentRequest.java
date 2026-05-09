package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateDraftIntentRequest(
    @NotBlank(message = "name은 필수 항목입니다.") @Size(max = 255, message = "name은 255자 이하여야 합니다.")
        String name,
    @Size(max = 1000, message = "description은 1000자 이하여야 합니다.") String description,
    @Min(value = 1, message = "taxonomyLevel은 1 이상이어야 합니다.") Integer taxonomyLevel,
    @Size(max = 5000, message = "entryConditionJson은 5000자 이하여야 합니다.") String entryConditionJson,
    @Size(max = 5000, message = "metaJson은 5000자 이하여야 합니다.") String metaJson) {}
