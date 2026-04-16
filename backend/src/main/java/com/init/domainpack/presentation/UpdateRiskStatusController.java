package com.init.domainpack.presentation;

import com.init.domainpack.application.RiskDefinitionResponse;
import com.init.domainpack.application.UpdateRiskStatusCommand;
import com.init.domainpack.application.UpdateRiskStatusUseCase;
import com.init.domainpack.presentation.dto.UpdateRiskStatusRequest;
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
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/risks/{riskId}")
public class UpdateRiskStatusController {

  private final UpdateRiskStatusUseCase useCase;

  public UpdateRiskStatusController(UpdateRiskStatusUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping("/status")
  public ResponseEntity<RiskDefinitionResponse> updateRiskStatus(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long riskId,
      @Valid @RequestBody UpdateRiskStatusRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateRiskStatusCommand command =
        new UpdateRiskStatusCommand(
            workspaceId, packId, versionId, riskId, userId, request.status());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
