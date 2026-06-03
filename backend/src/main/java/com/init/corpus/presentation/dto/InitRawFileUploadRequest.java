package com.init.corpus.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record InitRawFileUploadRequest(
    @NotBlank(message = "datasetKey는 필수입니다.")
        @Size(max = 100, message = "datasetKey는 100자 이하여야 합니다.")
        String datasetKey,
    @NotBlank(message = "name은 필수입니다.") @Size(max = 255, message = "name은 255자 이하여야 합니다.")
        String name,
    @NotBlank(message = "sourceType은 필수입니다.") @Size(max = 50, message = "sourceType은 50자 이하여야 합니다.")
        String sourceType,
    @NotBlank(message = "filename은 필수입니다.") @Size(max = 255, message = "filename은 255자 이하여야 합니다.")
        String filename,
    @NotBlank(message = "contentType은 필수입니다.")
        @Size(max = 100, message = "contentType은 100자 이하여야 합니다.")
        String contentType,
    @Positive(message = "sizeBytes는 양수여야 합니다.") long sizeBytes) {}
