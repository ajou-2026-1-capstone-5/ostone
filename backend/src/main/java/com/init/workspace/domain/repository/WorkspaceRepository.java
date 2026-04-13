package com.init.workspace.domain.repository;

import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface WorkspaceRepository {
  boolean existsByWorkspaceKey(WorkspaceKey workspaceKey);

  Workspace save(Workspace workspace);

  Optional<Workspace> findById(Long id);

  List<Workspace> findAllByIdIn(Collection<Long> ids);
}
