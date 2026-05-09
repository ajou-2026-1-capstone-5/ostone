package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

@SuppressWarnings("java:S110")
public class RestoreSourceNotPreviousPublishedException extends DuplicateException {

  public RestoreSourceNotPreviousPublishedException(Long versionId) {
    super(
        "RESTORE_SOURCE_NOT_PREVIOUS_PUBLISHED",
        "Restore Draft는 현재 운영 version보다 이전의 PUBLISHED version에서만 생성할 수 있습니다. versionId="
            + versionId);
  }
}
