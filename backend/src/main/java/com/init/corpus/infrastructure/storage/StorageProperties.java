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
    String presignEndpoint,
    String accessKey,
    String secretKey,
    boolean pathStyleAccess,
    boolean serverSideEncryptionEnabled) {

  /**
   * presigned URL 발급용 endpoint를 반환한다. MinIO처럼 내부 host와 브라우저 접근 host가 다른 경우 presign-endpoint를 설정하고,
   * 미설정 시 기존 endpoint로 fallback한다.
   */
  public String presignEndpointOrDefault() {
    if (presignEndpoint != null && !presignEndpoint.isBlank()) {
      return presignEndpoint;
    }
    return endpoint;
  }
}
