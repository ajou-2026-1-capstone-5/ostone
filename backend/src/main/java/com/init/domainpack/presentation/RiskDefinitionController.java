package com.init.domainpack.presentation;

import com.init.domainpack.application.GetRiskDefinitionQuery;
import com.init.domainpack.application.GetRiskDefinitionUseCase;
import com.init.domainpack.application.RiskDefinitionResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/risks")
public class RiskDefinitionController {

  private final GetRiskDefinitionUseCase useCase;

  public RiskDefinitionController(GetRiskDefinitionUseCase useCase) {
    this.useCase = useCase;
  }

  @GetMapping("/{riskId}")
  public ResponseEntity<RiskDefinitionResponse> getRisk(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long riskId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        useCase.execute(
            new GetRiskDefinitionQuery(workspaceId, packId, versionId, riskId, userId)));
  }
}
