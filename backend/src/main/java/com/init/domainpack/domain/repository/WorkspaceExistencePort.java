package com.init.domainpack.domain.repository;

/** domainpack bounded context 내 workspace 존재 확인 포트 (U-005 Confirmed). */
public interface WorkspaceExistencePort {

  boolean existsById(Long id);
}
