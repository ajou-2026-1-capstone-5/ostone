package com.init.domainpack.presentation;

import com.init.domainpack.application.GetPolicyDefinitionListQuery;
import com.init.domainpack.application.GetPolicyDefinitionListUseCase;
import com.init.domainpack.application.GetPolicyDefinitionQuery;
import com.init.domainpack.application.GetPolicyDefinitionUseCase;
import com.init.domainpack.application.PolicyDefinitionResponse;
import com.init.domainpack.application.PolicyDefinitionSummary;
import com.init.shared.presentation.AuthenticationUtils;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/policies")
public class PolicyDefinitionController {

  private final GetPolicyDefinitionListUseCase listUseCase;
  private final GetPolicyDefinitionUseCase detailUseCase;

  public PolicyDefinitionController(
      GetPolicyDefinitionListUseCase listUseCase, GetPolicyDefinitionUseCase detailUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
  }

  @GetMapping
  public ResponseEntity<List<PolicyDefinitionSummary>> listPolicies(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        listUseCase.execute(
            new GetPolicyDefinitionListQuery(workspaceId, packId, versionId, userId)));
  }

  @GetMapping("/{policyId}")
  public ResponseEntity<PolicyDefinitionResponse> getPolicy(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long policyId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        detailUseCase.execute(
            new GetPolicyDefinitionQuery(workspaceId, packId, versionId, policyId, userId)));
  }
}
