package com.init.domainpack.presentation;

import com.init.domainpack.application.RiskDefinitionResponse;
import com.init.domainpack.application.UpdateRiskCommand;
import com.init.domainpack.application.UpdateRiskUseCase;
import com.init.domainpack.presentation.dto.UpdateRiskRequest;
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
public class UpdateRiskController {

  private final UpdateRiskUseCase useCase;

  public UpdateRiskController(UpdateRiskUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping
  public ResponseEntity<RiskDefinitionResponse> updateRisk(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long riskId,
      @Valid @RequestBody UpdateRiskRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdateRiskCommand command =
        new UpdateRiskCommand(
            workspaceId,
            packId,
            versionId,
            riskId,
            userId,
            request.name(),
            request.description(),
            request.riskLevel(),
            request.triggerConditionJson(),
            request.handlingActionJson(),
            request.evidenceJson(),
            request.metaJson());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
