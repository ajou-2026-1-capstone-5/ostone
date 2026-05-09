package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

public class DomainPackVersionNotCurrentException extends DuplicateException {

  public DomainPackVersionNotCurrentException(Long versionId) {
    super(
        "DOMAIN_PACK_VERSION_NOT_CURRENT",
        "Intent 보정 Draft는 현재 운영 version에서만 생성할 수 있습니다. versionId=" + versionId);
  }
}
