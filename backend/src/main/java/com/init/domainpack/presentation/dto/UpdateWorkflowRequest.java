package com.init.domainpack.presentation.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UpdateWorkflowRequest(
    @NotBlank(message = "name은 필수 항목입니다.") String name,
    String description,
    @NotNull(message = "graphJson은 필수 항목입니다.") JsonNode graphJson) {}
