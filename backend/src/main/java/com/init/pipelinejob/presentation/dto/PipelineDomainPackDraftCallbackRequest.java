package com.init.pipelinejob.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PipelineDomainPackDraftCallbackRequest(
    @NotBlank(message = "externalEventId는 필수입니다.")
        @Size(max = 255, message = "externalEventId는 255자 이하여야 합니다.")
        String externalEventId,
    @NotBlank(message = "packKey는 필수입니다.") @Size(max = 100, message = "packKey는 100자 이하여야 합니다.")
        String packKey,
    @NotBlank(message = "packName은 필수입니다.") @Size(max = 255, message = "packName은 255자 이하여야 합니다.")
        String packName,
    @Size(max = 10000, message = "summaryJson은 10000자 이하여야 합니다.") String summaryJson) {}
