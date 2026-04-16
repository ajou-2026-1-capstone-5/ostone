package com.init.corpus.infrastructure.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "storage.s3")
public record StorageProperties(
    String bucketName,
    String region,
    String endpoint,
    String accessKey,
    String secretKey,
    boolean pathStyleAccess) {}
