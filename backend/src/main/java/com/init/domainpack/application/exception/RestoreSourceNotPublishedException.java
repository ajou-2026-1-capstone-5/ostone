package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class RestoreSourceNotPublishedException extends BadRequestException {

  public RestoreSourceNotPublishedException(Long versionId) {
    super(
        "RESTORE_SOURCE_NOT_PUBLISHED",
        "PUBLISHED 상태의 version만 Restore Draft 기준으로 사용할 수 있습니다. versionId=" + versionId);
  }
}
