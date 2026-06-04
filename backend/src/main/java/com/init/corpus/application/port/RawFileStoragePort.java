package com.init.corpus.application.port;

import java.time.Duration;
import java.util.Optional;

public interface RawFileStoragePort {

  /** objectKey 위치에 파일 bytes를 저장하고 확정된 objectKey를 반환한다. endpoint는 프로파일에 따라 AWS S3 또는 MinIO로 전환된다. */
  String put(String objectKey, byte[] content, String contentType);

  /** objectKey 위치의 파일을 삭제한다. S3 put 성공 + DB 실패 시 orphan 보상 처리용. */
  void delete(String objectKey);

  /**
   * 같은 버킷 내에서 server-side copy로 객체를 복제한다. presigned 업로드 완료 시 {@code pending/} 키를 {@code
   * completed/}로 승격해 lifecycle 만료 대상에서 빼는 데 쓴다. 단일 객체 최대 4GB 상한이므로 단일 CopyObjectRequest로 충분하다.
   *
   * @param sourceKey 복제 원본 객체 키
   * @param destKey 복제 대상 객체 키
   */
  void copyObject(String sourceKey, String destKey);

  /**
   * objectKey에 대한 presigned PUT URL을 발급한다. 클라이언트는 이 URL로 S3에 직접 업로드(최대 4GB)한다. 발급 시 사용한
   * contentType과 동일한 Content-Type 헤더로 업로드해야 서명이 일치한다.
   *
   * @param objectKey 업로드 대상 객체 키
   * @param contentType 업로드 시 강제할 Content-Type (서명에 포함)
   * @param ttl URL 유효 기간
   * @return presigned PUT URL 문자열
   */
  String generatePresignedPutUrl(String objectKey, String contentType, Duration ttl);

  /**
   * objectKey에 대한 객체 메타데이터를 조회한다. presigned 업로드 완료 검증용. 객체가 없으면 {@link Optional#empty()}를 반환한다.
   *
   * @param objectKey 조회 대상 객체 키
   * @return 객체가 존재하면 메타데이터, 없으면 empty
   */
  Optional<ObjectMetadata> headObject(String objectKey);

  /** S3 HEAD 응답에서 추출한 객체 메타데이터. */
  record ObjectMetadata(long contentLength, String etag) {}
}
