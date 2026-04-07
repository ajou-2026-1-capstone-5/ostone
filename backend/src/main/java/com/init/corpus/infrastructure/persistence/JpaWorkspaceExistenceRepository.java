package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.repository.WorkspaceExistenceRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkspaceExistenceRepository
    extends JpaRepository<WorkspaceRef, Long>, WorkspaceExistenceRepository {}
