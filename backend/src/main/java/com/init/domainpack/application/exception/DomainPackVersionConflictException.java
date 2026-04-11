package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class DomainPackVersionConflictException extends DuplicateException {
  public DomainPackVersionConflictException(Long versionId) {
    super("DOMAIN_PACK_CONFLICT", "도메인 팩 버전 충돌이 발생했습니다. id=" + versionId);
  }

  public DomainPackVersionConflictException(Long versionId, Throwable cause) {
    super("DOMAIN_PACK_CONFLICT", "도메인 팩 버전 충돌이 발생했습니다. id=" + versionId);
    initCause(cause);
  }
}
