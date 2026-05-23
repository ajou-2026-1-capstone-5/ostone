package com.init.domainpack.presentation;

import com.init.domainpack.application.DeployDomainPackVersionCommand;
import com.init.domainpack.application.DeployDomainPackVersionResult;
import com.init.domainpack.application.DeployDomainPackVersionUseCase;
import com.init.domainpack.presentation.dto.DomainPackVersionDeployResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}")
public class DeployDomainPackVersionController {

  private final DeployDomainPackVersionUseCase useCase;

  public DeployDomainPackVersionController(DeployDomainPackVersionUseCase useCase) {
    this.useCase = useCase;
  }

  @PostMapping("/deploy")
  public ResponseEntity<DomainPackVersionDeployResponse> deploy(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    DeployDomainPackVersionCommand command =
        new DeployDomainPackVersionCommand(workspaceId, packId, versionId, userId);
    DeployDomainPackVersionResult result = useCase.execute(command);
    return ResponseEntity.ok(
        new DomainPackVersionDeployResponse(
            result.id(),
            result.domainPackId(),
            result.versionNo(),
            result.lifecycleStatus(),
            result.publishedAt(),
            result.updatedAt()));
  }
}
