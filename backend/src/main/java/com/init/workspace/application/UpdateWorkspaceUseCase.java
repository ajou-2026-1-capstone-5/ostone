package com.init.workspace.application;

import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.application.exception.WorkspaceInvalidDescriptionException;
import com.init.workspace.application.exception.WorkspaceInvalidNameException;
import com.init.workspace.application.exception.WorkspaceNotFoundException;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateWorkspaceUseCase {

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;

  public UpdateWorkspaceUseCase(
      WorkspaceRepository workspaceRepository, WorkspaceMemberRepository workspaceMemberRepository) {
    this.workspaceRepository = workspaceRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
  }

  @Transactional
  public WorkspaceResult execute(UpdateWorkspaceCommand command) {
    Workspace workspace =
        workspaceRepository
            .findById(command.workspaceId())
            .orElseThrow(() -> new WorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다."));

    WorkspaceMember member =
        workspaceMemberRepository
            .findByWorkspaceIdAndUserId(command.workspaceId(), command.userId())
            .orElseThrow(
                () -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));

    if (member.getMemberRole() != WorkspaceMemberRole.OWNER
        && member.getMemberRole() != WorkspaceMemberRole.ADMIN) {
      throw new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다.");
    }

    String newName = command.nameProvided() ? command.name() : workspace.getName();
    if (command.nameProvided() && newName == null) {
      throw new WorkspaceInvalidNameException("워크스페이스 이름이 올바르지 않습니다.");
    }

    String newDescription =
        command.descriptionProvided() ? command.description() : workspace.getDescription();

    validateUpdateFields(newName, newDescription);
    workspace.update(newName, newDescription);

    Workspace savedWorkspace = workspaceRepository.save(workspace);
    return WorkspaceResult.from(savedWorkspace, member);
  }

  private void validateUpdateFields(String name, String description) {
    if (name == null || name.isBlank() || name.length() > 255) {
      throw new WorkspaceInvalidNameException("워크스페이스 이름이 올바르지 않습니다.");
    }
    if (description != null && description.length() > 2000) {
      throw new WorkspaceInvalidDescriptionException("워크스페이스 설명은 2000자를 초과할 수 없습니다.");
    }
  }
}
