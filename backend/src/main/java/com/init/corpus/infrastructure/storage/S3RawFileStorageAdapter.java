package com.init.corpus.infrastructure.storage;

import com.init.corpus.application.port.RawFileStoragePort;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Component
public class S3RawFileStorageAdapter implements RawFileStoragePort {

  private final S3Client s3Client;
  private final StorageProperties properties;

  public S3RawFileStorageAdapter(S3Client s3Client, StorageProperties properties) {
    this.s3Client = s3Client;
    this.properties = properties;
  }

  @Override
  public String put(String objectKey, byte[] content, String contentType) {
    PutObjectRequest request =
        PutObjectRequest.builder()
            .bucket(properties.bucketName())
            .key(objectKey)
            .contentType(contentType)
            .contentLength((long) content.length)
            .build();

    s3Client.putObject(request, RequestBody.fromBytes(content));
    return objectKey;
  }

  @Override
  public void delete(String objectKey) {
    DeleteObjectRequest request =
        DeleteObjectRequest.builder().bucket(properties.bucketName()).key(objectKey).build();

    s3Client.deleteObject(request);
  }
}
