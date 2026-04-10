package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DomainPackVersionNotFoundException extends NotFoundException {
  public DomainPackVersionNotFoundException(Long versionId) {
    super("DOMAIN_PACK_VERSION_NOT_FOUND", "도메인 팩 버전을 찾을 수 없습니다. id=" + versionId);
  }
}
