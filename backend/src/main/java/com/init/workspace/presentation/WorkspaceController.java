package com.init.workspace.presentation;

import com.init.workspace.application.ArchiveWorkspaceUseCase;
import com.init.workspace.application.CreateWorkspaceCommand;
import com.init.workspace.application.CreateWorkspaceUseCase;
import com.init.workspace.application.GetWorkspaceListUseCase;
import com.init.workspace.application.GetWorkspaceUseCase;
import com.init.workspace.application.UpdateWorkspaceCommand;
import com.init.workspace.application.UpdateWorkspaceUseCase;
import com.init.workspace.application.WorkspaceResult;
import com.init.workspace.presentation.dto.CreateWorkspaceRequest;
import com.init.workspace.presentation.dto.UpdateWorkspaceRequest;
import com.init.workspace.presentation.dto.WorkspaceResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces")
public class WorkspaceController {

  private final CreateWorkspaceUseCase createWorkspaceUseCase;
  private final GetWorkspaceListUseCase getWorkspaceListUseCase;
  private final GetWorkspaceUseCase getWorkspaceUseCase;
  private final UpdateWorkspaceUseCase updateWorkspaceUseCase;
  private final ArchiveWorkspaceUseCase archiveWorkspaceUseCase;

  public WorkspaceController(
      CreateWorkspaceUseCase createWorkspaceUseCase,
      GetWorkspaceListUseCase getWorkspaceListUseCase,
      GetWorkspaceUseCase getWorkspaceUseCase,
      UpdateWorkspaceUseCase updateWorkspaceUseCase,
      ArchiveWorkspaceUseCase archiveWorkspaceUseCase) {
    this.createWorkspaceUseCase = createWorkspaceUseCase;
    this.getWorkspaceListUseCase = getWorkspaceListUseCase;
    this.getWorkspaceUseCase = getWorkspaceUseCase;
    this.updateWorkspaceUseCase = updateWorkspaceUseCase;
    this.archiveWorkspaceUseCase = archiveWorkspaceUseCase;
  }

  @PostMapping
  public ResponseEntity<WorkspaceResponse> createWorkspace(
      @Valid @RequestBody CreateWorkspaceRequest request, Authentication authentication) {
    Long userId = extractUserId(authentication);
    WorkspaceResult result =
        createWorkspaceUseCase.execute(
            new CreateWorkspaceCommand(
                request.workspaceKey(), request.name(), request.description(), userId));
    return ResponseEntity.status(HttpStatus.CREATED).body(WorkspaceResponse.from(result));
  }

  @GetMapping
  public ResponseEntity<List<WorkspaceResponse>> listWorkspaces(Authentication authentication) {
    Long userId = extractUserId(authentication);
    List<WorkspaceResponse> response =
        getWorkspaceListUseCase.execute(userId).stream().map(WorkspaceResponse::from).toList();
    return ResponseEntity.ok(response);
  }

  @GetMapping("/{id}")
  public ResponseEntity<WorkspaceResponse> getWorkspace(
      @PathVariable Long id, Authentication authentication) {
    Long userId = extractUserId(authentication);
    return ResponseEntity.ok(WorkspaceResponse.from(getWorkspaceUseCase.execute(id, userId)));
  }

  @PatchMapping("/{id}")
  public ResponseEntity<WorkspaceResponse> updateWorkspace(
      @PathVariable Long id,
      @RequestBody UpdateWorkspaceRequest request,
      Authentication authentication) {
    Long userId = extractUserId(authentication);
    WorkspaceResult result =
        updateWorkspaceUseCase.execute(
            new UpdateWorkspaceCommand(
                id,
                userId,
                request.isNameProvided(),
                request.getName(),
                request.isDescriptionProvided(),
                request.getDescription()));
    return ResponseEntity.ok(WorkspaceResponse.from(result));
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> archiveWorkspace(
      @PathVariable Long id, Authentication authentication) {
    Long userId = extractUserId(authentication);
    archiveWorkspaceUseCase.execute(id, userId);
    return ResponseEntity.noContent().build();
  }

  private Long extractUserId(Authentication authentication) {
    if (authentication == null || !(authentication.getPrincipal() instanceof Long userId)) {
      throw new AuthenticationCredentialsNotFoundException("인증이 필요합니다.");
    }
    return userId;
  }
}
