package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class DomainPackVersionNotCurrentException extends BadRequestException {

  public DomainPackVersionNotCurrentException(Long versionId) {
    super(
        "DOMAIN_PACK_VERSION_NOT_CURRENT",
        "Intent 보정 Draft는 현재 운영 version에서만 생성할 수 있습니다. versionId=" + versionId);
  }
}
