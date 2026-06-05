package com.init.corpus.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.corpus.application.port.RawFileStoragePort.ObjectMetadata;
import java.net.MalformedURLException;
import java.net.URI;
import java.time.Duration;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CopyObjectResponse;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectResponse;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

@ExtendWith(MockitoExtension.class)
@DisplayName("S3RawFileStorageAdapter")
class S3RawFileStorageAdapterTest {

  @Mock private S3Client s3Client;
  @Mock private S3Presigner s3Presigner;

  private static final StorageProperties SSE_OFF =
      new StorageProperties("my-bucket", "ap-northeast-2", null, null, null, null, false, false);

  private static final StorageProperties SSE_ON =
      new StorageProperties("my-bucket", "ap-northeast-2", null, null, null, null, false, true);

  private S3RawFileStorageAdapter adapterSseOff;
  private S3RawFileStorageAdapter adapterSseOn;

  @BeforeEach
  void setUp() {
    adapterSseOff = new S3RawFileStorageAdapter(s3Client, s3Presigner, SSE_OFF);
    adapterSseOn = new S3RawFileStorageAdapter(s3Client, s3Presigner, SSE_ON);
  }

  // ── put ──────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("SSE 비활성화 시 put은 암호화 없이 S3에 업로드한다")
  void put_sseDisabled_uploadsWithoutEncryption() {
    given(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
        .willReturn(PutObjectResponse.builder().build());

    String result = adapterSseOff.put("workspaces/1/file.zip", new byte[10], "application/zip");

    assertThat(result).isEqualTo("workspaces/1/file.zip");
    ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
    verify(s3Client).putObject(captor.capture(), any(RequestBody.class));
    assertThat(captor.getValue().serverSideEncryption()).isNull();
  }

  @Test
  @DisplayName("SSE 활성화 시 put은 AES256 암호화를 포함해 S3에 업로드한다")
  void put_sseEnabled_uploadsWithAes256Encryption() {
    given(s3Client.putObject(any(PutObjectRequest.class), any(RequestBody.class)))
        .willReturn(PutObjectResponse.builder().build());

    adapterSseOn.put("workspaces/1/file.zip", new byte[5], "application/zip");

    ArgumentCaptor<PutObjectRequest> captor = ArgumentCaptor.forClass(PutObjectRequest.class);
    verify(s3Client).putObject(captor.capture(), any(RequestBody.class));
    assertThat(captor.getValue().serverSideEncryptionAsString()).isEqualTo("AES256");
  }

  // ── delete ───────────────────────────────────────────────────────────────

  @Test
  @DisplayName("delete는 지정한 objectKey로 S3 삭제 요청을 전송한다")
  void delete_sendsDeleteRequestWithCorrectKey() {
    given(s3Client.deleteObject(any(DeleteObjectRequest.class)))
        .willReturn(DeleteObjectResponse.builder().build());

    adapterSseOff.delete("workspaces/1/file.zip");

    ArgumentCaptor<DeleteObjectRequest> captor = ArgumentCaptor.forClass(DeleteObjectRequest.class);
    verify(s3Client).deleteObject(captor.capture());
    assertThat(captor.getValue().key()).isEqualTo("workspaces/1/file.zip");
    assertThat(captor.getValue().bucket()).isEqualTo("my-bucket");
  }

  // ── copyObject ───────────────────────────────────────────────────────────

  @Test
  @DisplayName("SSE 비활성화 시 copyObject는 암호화 없이 객체를 복사한다")
  void copyObject_sseDisabled_copiesWithoutEncryption() {
    given(s3Client.copyObject(any(CopyObjectRequest.class)))
        .willReturn(CopyObjectResponse.builder().build());

    adapterSseOff.copyObject("pending/key", "completed/key");

    ArgumentCaptor<CopyObjectRequest> captor = ArgumentCaptor.forClass(CopyObjectRequest.class);
    verify(s3Client).copyObject(captor.capture());
    CopyObjectRequest req = captor.getValue();
    assertThat(req.sourceKey()).isEqualTo("pending/key");
    assertThat(req.destinationKey()).isEqualTo("completed/key");
    assertThat(req.serverSideEncryption()).isNull();
  }

  @Test
  @DisplayName("SSE 활성화 시 copyObject는 AES256 암호화를 포함해 객체를 복사한다")
  void copyObject_sseEnabled_copiesWithAes256Encryption() {
    given(s3Client.copyObject(any(CopyObjectRequest.class)))
        .willReturn(CopyObjectResponse.builder().build());

    adapterSseOn.copyObject("pending/key", "completed/key");

    ArgumentCaptor<CopyObjectRequest> captor = ArgumentCaptor.forClass(CopyObjectRequest.class);
    verify(s3Client).copyObject(captor.capture());
    assertThat(captor.getValue().serverSideEncryptionAsString()).isEqualTo("AES256");
  }

  // ── generatePresignedPutUrl ──────────────────────────────────────────────

  @Test
  @DisplayName("SSE 비활성화 시 presigned URL을 발급한다")
  void generatePresignedPutUrl_sseDisabled_returnsUrl() throws MalformedURLException {
    PresignedPutObjectRequest presigned = org.mockito.Mockito.mock(PresignedPutObjectRequest.class);
    given(presigned.url())
        .willReturn(URI.create("https://s3.example.com/my-bucket/key?X-Amz=sig").toURL());
    given(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).willReturn(presigned);

    String url =
        adapterSseOff.generatePresignedPutUrl(
            "my/key.zip", "application/zip", Duration.ofMinutes(15));

    assertThat(url).contains("s3.example.com");
    ArgumentCaptor<PutObjectPresignRequest> captor =
        ArgumentCaptor.forClass(PutObjectPresignRequest.class);
    verify(s3Presigner).presignPutObject(captor.capture());
    assertThat(captor.getValue().putObjectRequest().serverSideEncryption()).isNull();
  }

  @Test
  @DisplayName("SSE 활성화 시 presigned URL 발급 요청에 AES256이 포함된다")
  void generatePresignedPutUrl_sseEnabled_includesEncryptionInRequest()
      throws MalformedURLException {
    PresignedPutObjectRequest presigned = org.mockito.Mockito.mock(PresignedPutObjectRequest.class);
    given(presigned.url())
        .willReturn(URI.create("https://s3.example.com/my-bucket/key?X-Amz=sig").toURL());
    given(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).willReturn(presigned);

    adapterSseOn.generatePresignedPutUrl("my/key.zip", "application/zip", Duration.ofMinutes(15));

    ArgumentCaptor<PutObjectPresignRequest> captor =
        ArgumentCaptor.forClass(PutObjectPresignRequest.class);
    verify(s3Presigner).presignPutObject(captor.capture());
    assertThat(captor.getValue().putObjectRequest().serverSideEncryptionAsString())
        .isEqualTo("AES256");
  }

  // ── headObject ───────────────────────────────────────────────────────────

  @Test
  @DisplayName("객체가 존재하면 headObject는 메타데이터를 반환한다")
  void headObject_objectExists_returnsMetadata() {
    given(s3Client.headObject(any(HeadObjectRequest.class)))
        .willReturn(HeadObjectResponse.builder().contentLength(2048L).eTag("\"etag-abc\"").build());

    Optional<ObjectMetadata> result = adapterSseOff.headObject("workspaces/1/file.zip");

    assertThat(result).isPresent();
    assertThat(result.get().contentLength()).isEqualTo(2048L);
    assertThat(result.get().etag()).isEqualTo("\"etag-abc\"");
  }

  @Test
  @DisplayName("객체가 없으면 headObject는 empty를 반환한다")
  void headObject_objectMissing_returnsEmpty() {
    given(s3Client.headObject(any(HeadObjectRequest.class)))
        .willThrow(NoSuchKeyException.builder().message("Not Found").build());

    Optional<ObjectMetadata> result = adapterSseOff.headObject("workspaces/1/missing.zip");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("S3 headObject가 404를 반환하면 empty를 반환한다")
  void headObject_s3NotFoundStatus_returnsEmpty() {
    given(s3Client.headObject(any(HeadObjectRequest.class)))
        .willThrow(S3Exception.builder().statusCode(404).message("Not Found").build());

    Optional<ObjectMetadata> result = adapterSseOff.headObject("workspaces/1/missing.zip");

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("S3 headObject가 404 외 오류를 반환하면 예외를 전파한다")
  void headObject_s3NonNotFoundStatus_propagatesException() {
    given(s3Client.headObject(any(HeadObjectRequest.class)))
        .willThrow(S3Exception.builder().statusCode(503).message("Slow Down").build());

    assertThatThrownBy(() -> adapterSseOff.headObject("workspaces/1/file.zip"))
        .isInstanceOf(S3Exception.class)
        .hasMessageContaining("Slow Down");
  }
}
