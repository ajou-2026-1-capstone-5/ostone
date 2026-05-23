package com.init.domainpack.application.exception;

import com.init.shared.application.exception.BadRequestException;

public class DomainPackVersionNotPublishableException extends BadRequestException {

  public DomainPackVersionNotPublishableException(long draftIntentCount) {
    super(
        "DOMAIN_PACK_VERSION_NOT_PUBLISHABLE",
        "DRAFT 상태의 Intent가 " + draftIntentCount + "개 남아 있어 Domain Pack Version을 발행할 수 없습니다.");
  }
}
