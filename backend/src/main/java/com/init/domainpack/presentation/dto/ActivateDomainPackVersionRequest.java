package com.init.domainpack.presentation.dto;

import jakarta.validation.constraints.Size;

public record ActivateDomainPackVersionRequest(
    @Size(max = 50, message = "description은 50자 이하여야 합니다.") String description) {}
