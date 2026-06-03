package com.init.corpus.infrastructure.storage;

import java.net.URI;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.S3Presigner.Builder;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {

  @Bean
  public S3Client s3Client(StorageProperties properties) {
    S3ClientBuilder builder = S3Client.builder().region(Region.of(properties.region()));

    builder.credentialsProvider(resolveCredentialsProvider(properties));

    if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
      builder.endpointOverride(URI.create(properties.endpoint()));
    }

    if (properties.pathStyleAccess()) {
      builder.forcePathStyle(true);
    }

    return builder.build();
  }

  /**
   * presigned URL 발급 전용 presigner. S3Client와 동일한 자격증명/region/pathStyle을 쓰되, endpoint는
   * presign-endpoint(있으면)를 사용해 브라우저가 접근 가능한 host로 URL을 발급한다.
   */
  @Bean
  public S3Presigner s3Presigner(StorageProperties properties) {
    Builder builder =
        S3Presigner.builder()
            .region(Region.of(properties.region()))
            .credentialsProvider(resolveCredentialsProvider(properties));

    String presignEndpoint = properties.presignEndpointOrDefault();
    if (presignEndpoint != null && !presignEndpoint.isBlank()) {
      builder.endpointOverride(URI.create(presignEndpoint));
    }

    if (properties.pathStyleAccess()) {
      builder.serviceConfiguration(
          software.amazon.awssdk.services.s3.S3Configuration.builder()
              .pathStyleAccessEnabled(true)
              .build());
    }

    return builder.build();
  }

  private AwsCredentialsProvider resolveCredentialsProvider(StorageProperties properties) {
    boolean accessKeyPresent = properties.accessKey() != null && !properties.accessKey().isBlank();
    boolean secretKeyPresent = properties.secretKey() != null && !properties.secretKey().isBlank();

    if (accessKeyPresent != secretKeyPresent) {
      throw new IllegalArgumentException(
          "Both accessKey and secretKey must be provided together, or neither should be set");
    }

    if (accessKeyPresent) {
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(properties.accessKey(), properties.secretKey()));
    }
    return DefaultCredentialsProvider.create();
  }
}
