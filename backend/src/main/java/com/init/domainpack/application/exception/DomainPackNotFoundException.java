package com.init.domainpack.application.exception;

public class DomainPackNotFoundException extends RuntimeException {

  public DomainPackNotFoundException(Long packId) {
    super("DomainPack not found: " + packId);
  }
}
