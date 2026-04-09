package com.init.domainpack.presentation;

import com.init.domainpack.application.ActivateDomainPackVersionCommand;
import com.init.domainpack.application.ActivateDomainPackVersionResult;
import com.init.domainpack.application.ActivateDomainPackVersionUseCase;
import com.init.domainpack.presentation.dto.DomainPackVersionActivateResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
      Authentication authentication) {
    Long userId = getUserIdFromAuthentication(authentication);
    ActivateDomainPackVersionCommand command =
        new ActivateDomainPackVersionCommand(workspaceId, packId, versionId, userId);
    ActivateDomainPackVersionResult result = useCase.execute(command);
    return ResponseEntity.ok(
        new DomainPackVersionActivateResponse(
            result.id(),
            result.domainPackId(),
            result.versionNo(),
            result.lifecycleStatus(),
            result.publishedAt(),
            result.updatedAt()));
  }

  /**
   * Authentication principal을 Long userId로 안전하게 추출한다.
   *
   * @throws AuthenticationCredentialsNotFoundException authentication이 null이거나 principal이 null일 때
   *     (401)
   * @throws AccessDeniedException principal이 Long 타입이 아닐 때 (403)
   */
  private Long getUserIdFromAuthentication(Authentication authentication) {
    if (authentication == null) {
      throw new AuthenticationCredentialsNotFoundException("Authentication must not be null");
    }
    Object principal = authentication.getPrincipal();
    if (principal == null) {
      throw new AuthenticationCredentialsNotFoundException(
          "Authentication principal must not be null");
    }
    if (!(principal instanceof Long)) {
      throw new AccessDeniedException(
          "Authentication principal must be of type Long, but was: "
              + principal.getClass().getName());
    }
    return (Long) principal;
  }
}
