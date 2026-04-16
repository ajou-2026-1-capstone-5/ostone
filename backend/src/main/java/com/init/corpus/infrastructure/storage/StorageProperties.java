package com.init.corpus.infrastructure.storage;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@ConfigurationProperties(prefix = "storage.s3")
@Validated
public record StorageProperties(
    @NotBlank String bucketName,
    @NotBlank String region,
    String endpoint,
    String accessKey,
    String secretKey,
    boolean pathStyleAccess) {}
