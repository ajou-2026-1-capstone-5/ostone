package com.init.workspace.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(
    @NotBlank String workspaceKey,
    @NotBlank @Size(max = 255) String name,
    @Size(max = 2000) String description) {}
