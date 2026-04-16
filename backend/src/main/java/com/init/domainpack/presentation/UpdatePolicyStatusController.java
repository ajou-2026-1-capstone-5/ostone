package com.init.domainpack.presentation;

import com.init.domainpack.application.PolicyDefinitionResponse;
import com.init.domainpack.application.UpdatePolicyStatusCommand;
import com.init.domainpack.application.UpdatePolicyStatusUseCase;
import com.init.domainpack.presentation.dto.UpdatePolicyStatusRequest;
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
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/policies/{policyId}")
public class UpdatePolicyStatusController {

  private final UpdatePolicyStatusUseCase useCase;

  public UpdatePolicyStatusController(UpdatePolicyStatusUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping("/status")
  public ResponseEntity<PolicyDefinitionResponse> updatePolicyStatus(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long policyId,
      @Valid @RequestBody UpdatePolicyStatusRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdatePolicyStatusCommand command =
        new UpdatePolicyStatusCommand(
            workspaceId, packId, versionId, policyId, userId, request.status());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
