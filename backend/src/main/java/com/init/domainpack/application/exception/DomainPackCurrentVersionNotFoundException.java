package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DomainPackCurrentVersionNotFoundException extends NotFoundException {

  public DomainPackCurrentVersionNotFoundException(Long packId) {
    super(
        "DOMAIN_PACK_CURRENT_VERSION_NOT_FOUND",
        "현재 운영 중인 PUBLISHED version을 찾을 수 없습니다. packId=" + packId);
  }
}
