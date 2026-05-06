package com.init.pipelinejob.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class CallbackTargetVersionNotFoundException extends NotFoundException {

  public CallbackTargetVersionNotFoundException(Long versionId) {
    super("DOMAIN_PACK_VERSION_NOT_FOUND", "도메인 팩 버전을 찾을 수 없습니다. id=" + versionId);
  }
}
