package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class DomainPackVersionCloneFailedException extends DuplicateException {

  public DomainPackVersionCloneFailedException(Long packId, Throwable cause) {
    super("DOMAIN_PACK_VERSION_CLONE_FAILED", "도메인 팩 버전 복제에 실패했습니다. packId=" + packId);
    initCause(cause);
  }
}
