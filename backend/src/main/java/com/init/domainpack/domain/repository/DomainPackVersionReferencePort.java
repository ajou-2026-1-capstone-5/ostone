package com.init.domainpack.domain.repository;

public interface DomainPackVersionReferencePort {

  boolean existsExternalReference(Long domainPackVersionId);
}
