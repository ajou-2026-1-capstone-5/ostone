package com.init.corpus.infrastructure.storage;

import com.init.corpus.application.port.RawFileStoragePort;
import java.time.Duration;
import java.util.Optional;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.ServerSideEncryption;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@Component
public class S3RawFileStorageAdapter implements RawFileStoragePort {

  private final S3Client s3Client;
  private final S3Presigner s3Presigner;
  private final StorageProperties properties;

  public S3RawFileStorageAdapter(
      S3Client s3Client, S3Presigner s3Presigner, StorageProperties properties) {
    this.s3Client = s3Client;
    this.s3Presigner = s3Presigner;
    this.properties = properties;
  }

  @Override
  public String put(String objectKey, byte[] content, String contentType) {
    PutObjectRequest.Builder builder =
        PutObjectRequest.builder()
            .bucket(properties.bucketName())
            .key(objectKey)
            .contentType(contentType)
            .contentLength((long) content.length);
    if (properties.serverSideEncryptionEnabled()) {
      builder.serverSideEncryption(ServerSideEncryption.AES256);
    }
    PutObjectRequest request = builder.build();

    s3Client.putObject(request, RequestBody.fromBytes(content));
    return objectKey;
  }

  @Override
  public void delete(String objectKey) {
    DeleteObjectRequest request =
        DeleteObjectRequest.builder().bucket(properties.bucketName()).key(objectKey).build();

    s3Client.deleteObject(request);
  }

  @Override
  public void copyObject(String sourceKey, String destKey) {
    CopyObjectRequest.Builder builder =
        CopyObjectRequest.builder()
            .sourceBucket(properties.bucketName())
            .sourceKey(sourceKey)
            .destinationBucket(properties.bucketName())
            .destinationKey(destKey);
    if (properties.serverSideEncryptionEnabled()) {
      builder.serverSideEncryption(ServerSideEncryption.AES256);
    }

    s3Client.copyObject(builder.build());
  }

  @Override
  public String generatePresignedPutUrl(String objectKey, String contentType, Duration ttl) {
    PutObjectRequest.Builder objectBuilder =
        PutObjectRequest.builder()
            .bucket(properties.bucketName())
            .key(objectKey)
            .contentType(contentType);
    if (properties.serverSideEncryptionEnabled()) {
      objectBuilder.serverSideEncryption(ServerSideEncryption.AES256);
    }

    PutObjectPresignRequest presignRequest =
        PutObjectPresignRequest.builder()
            .signatureDuration(ttl)
            .putObjectRequest(objectBuilder.build())
            .build();

    PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
    return presigned.url().toString();
  }

  @Override
  public Optional<ObjectMetadata> headObject(String objectKey) {
    HeadObjectRequest request =
        HeadObjectRequest.builder().bucket(properties.bucketName()).key(objectKey).build();
    try {
      HeadObjectResponse response = s3Client.headObject(request);
      return Optional.of(new ObjectMetadata(response.contentLength(), response.eTag()));
    } catch (NoSuchKeyException e) {
      return Optional.empty();
    }
  }
}
