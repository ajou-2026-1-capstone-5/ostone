package com.init.domainpack.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class DomainPackNotFoundException extends NotFoundException {

  public DomainPackNotFoundException(Long packId) {
    super("DOMAIN_PACK_NOT_FOUND", "DomainPack not found: " + packId);
  }
}
