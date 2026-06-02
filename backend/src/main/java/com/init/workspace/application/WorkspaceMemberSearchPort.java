package com.init.workspace.application;

import com.init.workspace.domain.model.WorkspaceMemberRole;
import java.util.List;

public interface WorkspaceMemberSearchPort {
  List<WorkspaceMemberListEntry> searchMembers(
      Long workspaceId, String search, WorkspaceMemberRole role);
}
