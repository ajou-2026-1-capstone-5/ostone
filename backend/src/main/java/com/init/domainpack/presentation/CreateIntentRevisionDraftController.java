package com.init.domainpack.presentation;

import com.init.domainpack.application.CreateIntentRevisionDraftCommand;
import com.init.domainpack.application.CreateIntentRevisionDraftUseCase;
import com.init.domainpack.application.IntentRevisionDraftResult;
import com.init.domainpack.presentation.dto.CreateIntentRevisionDraftRequest;
import com.init.domainpack.presentation.dto.IntentRevisionDraftResponse;
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
public class CreateIntentRevisionDraftController {

  private final CreateIntentRevisionDraftUseCase useCase;

  public CreateIntentRevisionDraftController(CreateIntentRevisionDraftUseCase useCase) {
    this.useCase = useCase;
  }

  @PostMapping("/revision-drafts")
  public ResponseEntity<IntentRevisionDraftResponse> create(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @Valid @RequestBody(required = false) CreateIntentRevisionDraftRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    String reason = request == null ? null : request.reason();
    IntentRevisionDraftResult result =
        useCase.execute(
            new CreateIntentRevisionDraftCommand(workspaceId, packId, versionId, userId, reason));
    return ResponseEntity.status(HttpStatus.CREATED).body(IntentRevisionDraftResponse.from(result));
  }
}
