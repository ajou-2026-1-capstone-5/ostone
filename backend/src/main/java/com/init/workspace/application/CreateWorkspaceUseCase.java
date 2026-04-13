package com.init.workspace.application;

import com.init.workspace.application.exception.WorkspaceInvalidKeyException;
import com.init.workspace.application.exception.WorkspaceKeyAlreadyExistsException;
import com.init.workspace.domain.model.Workspace;
import com.init.workspace.domain.model.WorkspaceKey;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CreateWorkspaceUseCase {

  private final WorkspaceRepository workspaceRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;

  public CreateWorkspaceUseCase(
      WorkspaceRepository workspaceRepository,
      WorkspaceMemberRepository workspaceMemberRepository) {
    this.workspaceRepository = workspaceRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
  }

  @Transactional
  public WorkspaceResult execute(CreateWorkspaceCommand command) {
    WorkspaceKey workspaceKey = parseWorkspaceKey(command.workspaceKey());

    if (workspaceRepository.existsByWorkspaceKey(workspaceKey)) {
      throw new WorkspaceKeyAlreadyExistsException("이미 사용 중인 워크스페이스 키입니다.");
    }

    Workspace savedWorkspace;
    try {
      savedWorkspace =
          workspaceRepository.save(
              Workspace.create(workspaceKey, command.name(), command.description()));
    } catch (DataIntegrityViolationException ex) {
      if (isWorkspaceKeyConstraintViolation(ex)) {
        throw new WorkspaceKeyAlreadyExistsException("이미 사용 중인 워크스페이스 키입니다.", ex);
      }
      throw ex;
    }

    WorkspaceMember ownerMember =
        workspaceMemberRepository.save(
            WorkspaceMember.create(
                savedWorkspace.getId(), command.ownerUserId(), WorkspaceMemberRole.OWNER));
    return WorkspaceResult.from(savedWorkspace, ownerMember);
  }

  private WorkspaceKey parseWorkspaceKey(String rawWorkspaceKey) {
    try {
      return WorkspaceKey.of(rawWorkspaceKey);
    } catch (IllegalArgumentException ex) {
      throw new WorkspaceInvalidKeyException("workspaceKey 형식이 올바르지 않습니다.");
    }
  }

  private boolean isWorkspaceKeyConstraintViolation(DataIntegrityViolationException ex) {
    Throwable cause = ex.getCause();
    if (cause instanceof org.hibernate.exception.ConstraintViolationException violationException) {
      String constraintName = violationException.getConstraintName();
      return constraintName != null && constraintName.contains("workspace_key");
    }

    Throwable rootCause = ex.getMostSpecificCause();
    String message = rootCause != null ? rootCause.getMessage() : null;
    return message != null && message.contains("workspace_key");
  }
}
