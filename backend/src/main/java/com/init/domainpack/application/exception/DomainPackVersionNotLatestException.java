package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

@SuppressWarnings("java:S110")
public class DomainPackVersionNotLatestException extends DuplicateException {

  public DomainPackVersionNotLatestException(Long versionId) {
    super(
        "DOMAIN_PACK_VERSION_NOT_LATEST",
        "최신 DRAFT version만 activate할 수 있습니다. versionId=" + versionId);
  }
}
