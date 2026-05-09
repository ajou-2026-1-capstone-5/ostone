package com.init.domainpack.application.exception;

import com.init.shared.application.exception.DuplicateException;

@SuppressWarnings("java:S110")
public class DomainPackDraftAlreadyExistsException extends DuplicateException {

  public DomainPackDraftAlreadyExistsException(Long packId) {
    super("DOMAIN_PACK_DRAFT_ALREADY_EXISTS", "이미 처리 중인 DRAFT version이 있습니다. packId=" + packId);
  }
}
