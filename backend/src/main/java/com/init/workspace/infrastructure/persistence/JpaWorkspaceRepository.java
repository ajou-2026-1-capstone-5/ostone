package com.init.workspace.infrastructure.persistence;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaWorkspaceRepository extends JpaRepository<Workspace, Long>, WorkspaceRepository {

  boolean existsByWorkspaceKey(WorkspaceKey workspaceKey);

  List<Workspace> findAllByIdIn(Collection<Long> ids);
}
