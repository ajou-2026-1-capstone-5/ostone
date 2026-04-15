package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DomainPackVersionNotDraftException extends BadRequestException {

  public DomainPackVersionNotDraftException(Long versionId) {
    super(
        "DOMAIN_PACK_VERSION_NOT_DRAFT",
        "DRAFT 상태가 아닌 버전에는 intent를 추가할 수 없습니다. versionId=" + versionId);
  }
}
