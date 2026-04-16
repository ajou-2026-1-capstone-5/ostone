package com.init.domainpack.presentation;

import com.init.domainpack.application.PolicyDefinitionResponse;
import com.init.domainpack.application.UpdatePolicyCommand;
import com.init.domainpack.application.UpdatePolicyUseCase;
import com.init.domainpack.presentation.dto.UpdatePolicyRequest;
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
public class UpdatePolicyController {

  private final UpdatePolicyUseCase useCase;

  public UpdatePolicyController(UpdatePolicyUseCase useCase) {
    this.useCase = useCase;
  }

  @PatchMapping
  public ResponseEntity<PolicyDefinitionResponse> updatePolicy(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long policyId,
      @Valid @RequestBody UpdatePolicyRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    UpdatePolicyCommand command =
        new UpdatePolicyCommand(
            workspaceId,
            packId,
            versionId,
            policyId,
            userId,
            request.name(),
            request.description(),
            request.severity(),
            request.conditionJson(),
            request.actionJson(),
            request.evidenceJson(),
            request.metaJson());
    return ResponseEntity.ok(useCase.execute(command));
  }
}
