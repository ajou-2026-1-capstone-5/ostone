package com.init.domainpack.presentation;

import com.init.domainpack.application.IntentDefinitionStatusResponse;
import com.init.domainpack.application.UpdateIntentStatusCommand;
import com.init.domainpack.application.UpdateIntentStatusUseCase;
import com.init.domainpack.presentation.dto.UpdateIntentStatusRequest;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/intents/{intentId}")
public class UpdateIntentStatusController {

  private final UpdateIntentStatusUseCase useCase;

  public UpdateIntentStatusController(UpdateIntentStatusUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping("/status")
  public ResponseEntity<IntentDefinitionStatusResponse> updateIntentStatus(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long intentId,
      @Valid @RequestBody UpdateIntentStatusRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateIntentStatusCommand command =
        new UpdateIntentStatusCommand(
            workspaceId, packId, versionId, intentId, userId, request.status());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
