package com.init.domainpack.presentation;

import com.init.domainpack.application.SlotDefinitionResponse;
import com.init.domainpack.application.UpdateSlotStatusCommand;
import com.init.domainpack.application.UpdateSlotStatusUseCase;
import com.init.domainpack.presentation.dto.UpdateSlotStatusRequest;
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
public class UpdateSlotStatusController {

  private final UpdateSlotStatusUseCase useCase;

  public UpdateSlotStatusController(UpdateSlotStatusUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping("/status")
  public ResponseEntity<SlotDefinitionResponse> updateSlotStatus(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long slotId,
      @Valid @RequestBody UpdateSlotStatusRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateSlotStatusCommand command =
        new UpdateSlotStatusCommand(
            workspaceId, packId, versionId, slotId, userId, request.status());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
