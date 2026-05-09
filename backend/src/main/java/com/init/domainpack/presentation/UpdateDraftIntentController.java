package com.init.domainpack.presentation;

import com.init.domainpack.application.IntentDefinitionDetail;
import com.init.domainpack.application.UpdateDraftIntentCommand;
import com.init.domainpack.application.UpdateDraftIntentUseCase;
import com.init.domainpack.presentation.dto.UpdateDraftIntentRequest;
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
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{draftVersionId}/intents/{intentId}")
public class UpdateDraftIntentController {

  private final UpdateDraftIntentUseCase useCase;

  public UpdateDraftIntentController(UpdateDraftIntentUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping
  public ResponseEntity<IntentDefinitionDetail> update(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long draftVersionId,
      @PathVariable Long intentId,
      @Valid @RequestBody UpdateDraftIntentRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        useCase.execute(
            new UpdateDraftIntentCommand(
                workspaceId,
                packId,
                draftVersionId,
                intentId,
                userId,
                request.name(),
                request.description(),
                request.taxonomyLevel(),
                request.entryConditionJson(),
                request.metaJson())));
  }
}
