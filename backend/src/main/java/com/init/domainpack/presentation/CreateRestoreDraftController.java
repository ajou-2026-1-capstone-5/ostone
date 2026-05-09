package com.init.domainpack.presentation;

import com.init.domainpack.application.CreateRestoreDraftCommand;
import com.init.domainpack.application.CreateRestoreDraftUseCase;
import com.init.domainpack.application.RestoreDraftResult;
import com.init.domainpack.presentation.dto.CreateRestoreDraftRequest;
import com.init.domainpack.presentation.dto.RestoreDraftResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}")
public class CreateRestoreDraftController {

  private final CreateRestoreDraftUseCase useCase;

  public CreateRestoreDraftController(CreateRestoreDraftUseCase useCase) {
    this.useCase = useCase;
  }

  @PostMapping("/restore-drafts")
  public ResponseEntity<RestoreDraftResponse> create(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @Valid @RequestBody(required = false) CreateRestoreDraftRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    String reason = request == null ? null : request.reason();
    RestoreDraftResult result =
        useCase.execute(
            new CreateRestoreDraftCommand(workspaceId, packId, versionId, userId, reason));
    return ResponseEntity.status(HttpStatus.CREATED).body(RestoreDraftResponse.from(result));
  }
}
