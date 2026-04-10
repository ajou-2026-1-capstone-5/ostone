package com.init.domainpack.application.exception;

public class DomainPackVersionConflictException extends RuntimeException {

  public DomainPackVersionConflictException(Long versionId) {
    super("Domain pack version was modified by another request: " + versionId);
  }
}
