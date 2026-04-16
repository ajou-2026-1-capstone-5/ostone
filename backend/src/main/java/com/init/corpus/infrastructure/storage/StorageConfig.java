package com.init.corpus.infrastructure.storage;

import java.net.URI;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;

@Configuration
@EnableConfigurationProperties(StorageProperties.class)
public class StorageConfig {

  @Bean
  public S3Client s3Client(StorageProperties properties) {
    S3ClientBuilder builder = S3Client.builder().region(Region.of(properties.region()));

    boolean hasExplicitCredentials =
        properties.accessKey() != null
            && !properties.accessKey().isBlank()
            && properties.secretKey() != null
            && !properties.secretKey().isBlank();

    if (hasExplicitCredentials) {
      builder.credentialsProvider(
          StaticCredentialsProvider.create(
              AwsBasicCredentials.create(properties.accessKey(), properties.secretKey())));
    } else {
      builder.credentialsProvider(DefaultCredentialsProvider.create());
    }

    if (properties.endpoint() != null && !properties.endpoint().isBlank()) {
      builder.endpointOverride(URI.create(properties.endpoint()));
    }

    if (properties.pathStyleAccess()) {
      builder.forcePathStyle(true);
    }

    return builder.build();
  }
}
