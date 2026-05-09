package com.init.domainpack.presentation;

import com.init.domainpack.application.DiscardDraftVersionCommand;
import com.init.domainpack.application.DiscardDraftVersionUseCase;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{draftVersionId}/draft")
public class DiscardDraftVersionController {

  private final DiscardDraftVersionUseCase useCase;

  public DiscardDraftVersionController(DiscardDraftVersionUseCase useCase) {
    this.useCase = useCase;
  }

  @DeleteMapping
  public ResponseEntity<Void> discard(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long draftVersionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    useCase.execute(new DiscardDraftVersionCommand(workspaceId, packId, draftVersionId, userId));
    return ResponseEntity.noContent().build();
  }
}
