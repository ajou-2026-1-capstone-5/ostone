package com.init.corpus.application;

/** {@code dataset.meta_json}의 {@code upload} 객체에 보관하는 presigned 업로드 세션 필드 키. */
final class UploadSessionMeta {

  static final String FIELD = "upload";
  static final String OBJECT_KEY = "objectKey";
  static final String EXPECTED_SIZE_BYTES = "expectedSizeBytes";
  static final String FILENAME = "filename";
  static final String CONTENT_TYPE = "contentType";
  static final String EXPIRES_AT = "expiresAt";
  static final String CREATED_BY = "createdBy";

  private UploadSessionMeta() {}
}
