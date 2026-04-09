package com.init.domainpack.application.exception;

public class DomainPackVersionNotFoundException extends RuntimeException {

  public DomainPackVersionNotFoundException(Long versionId) {
    super("DomainPackVersion not found: " + versionId);
  }
}
