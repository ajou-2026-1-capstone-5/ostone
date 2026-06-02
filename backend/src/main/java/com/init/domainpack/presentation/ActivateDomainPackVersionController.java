package com.init.domainpack.presentation;

import com.init.domainpack.application.ActivateDomainPackVersionCommand;
import com.init.domainpack.application.ActivateDomainPackVersionResult;
import com.init.domainpack.application.ActivateDomainPackVersionUseCase;
import com.init.domainpack.presentation.dto.ActivateDomainPackVersionRequest;
import com.init.domainpack.presentation.dto.DomainPackVersionActivateResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}")
public class ActivateDomainPackVersionController {

  private final ActivateDomainPackVersionUseCase useCase;

  public ActivateDomainPackVersionController(ActivateDomainPackVersionUseCase useCase) {
    this.useCase = useCase;
  }

  @PostMapping("/activate")
  public ResponseEntity<DomainPackVersionActivateResponse> activate(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @Valid @RequestBody(required = false) ActivateDomainPackVersionRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    String description = request == null ? null : request.description();
    ActivateDomainPackVersionCommand command =
        new ActivateDomainPackVersionCommand(workspaceId, packId, versionId, userId, description);
    ActivateDomainPackVersionResult result = useCase.execute(command);
    return ResponseEntity.ok(
        new DomainPackVersionActivateResponse(
            result.id(),
            result.domainPackId(),
            result.versionNo(),
            result.lifecycleStatus(),
            result.description(),
            result.publishedAt(),
            result.updatedAt()));
  }
}
