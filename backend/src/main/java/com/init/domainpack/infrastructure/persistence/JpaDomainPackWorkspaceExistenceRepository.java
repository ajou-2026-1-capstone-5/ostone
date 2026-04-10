package com.init.domainpack.infrastructure.persistence;

import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaDomainPackWorkspaceExistenceRepository
    extends JpaRepository<DomainPackWorkspaceRef, Long>, WorkspaceExistencePort {}
