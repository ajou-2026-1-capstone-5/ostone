package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

@SuppressWarnings("java:S110")
public class DomainPackDraftInUseException extends BadRequestException {

  public DomainPackDraftInUseException(Long versionId) {
    super(
        "DOMAIN_PACK_DRAFT_IN_USE",
        "다른 데이터가 참조 중인 DRAFT version은 폐기할 수 없습니다. versionId=" + versionId);
  }

  public DomainPackDraftInUseException(Long versionId, Throwable cause) {
    super(
        "DOMAIN_PACK_DRAFT_IN_USE",
        "다른 데이터가 참조 중인 DRAFT version은 폐기할 수 없습니다. versionId=" + versionId,
        cause);
  }
}
