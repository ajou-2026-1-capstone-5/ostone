package com.init.corpus.application.port;

public interface RawFileStoragePort {

  /** objectKey 위치에 파일 bytes를 저장하고 확정된 objectKey를 반환한다. endpoint는 프로파일에 따라 AWS S3 또는 MinIO로 전환된다. */
  String put(String objectKey, byte[] content, String contentType);

  /** objectKey 위치의 파일을 삭제한다. S3 put 성공 + DB 실패 시 orphan 보상 처리용. */
  void delete(String objectKey);
}
