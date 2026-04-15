package com.init.domainpack.presentation;

import com.init.domainpack.application.SlotDefinitionResponse;
import com.init.domainpack.application.UpdateSlotCommand;
import com.init.domainpack.application.UpdateSlotUseCase;
import com.init.domainpack.presentation.dto.UpdateSlotRequest;
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
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/slots/{slotId}")
public class UpdateSlotController {

  private final UpdateSlotUseCase useCase;

  public UpdateSlotController(UpdateSlotUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping
  public ResponseEntity<SlotDefinitionResponse> updateSlot(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long slotId,
      @Valid @RequestBody UpdateSlotRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateSlotCommand command =
        new UpdateSlotCommand(
            workspaceId,
            packId,
            versionId,
            slotId,
            userId,
            request.name(),
            request.description(),
            request.isSensitive(),
            request.validationRuleJson(),
            request.defaultValueJson(),
            request.metaJson());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
