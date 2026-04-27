package com.init.domainpack.presentation;

import com.init.domainpack.application.DomainPackDraftEntryResult;
import com.init.domainpack.application.GetDomainPackDraftEntryQuery;
import com.init.domainpack.application.GetDomainPackDraftEntryUseCase;
import com.init.domainpack.presentation.dto.DomainPackDraftEntryResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs")
public class DomainPackDraftEntryController {

  private final GetDomainPackDraftEntryUseCase useCase;

  public DomainPackDraftEntryController(GetDomainPackDraftEntryUseCase useCase) {
    this.useCase = useCase;
  }

  @GetMapping("/draft-entry")
  public ResponseEntity<DomainPackDraftEntryResponse> getDraftEntry(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    DomainPackDraftEntryResult result =
        useCase.execute(new GetDomainPackDraftEntryQuery(workspaceId, userId));

    return ResponseEntity.ok(
        new DomainPackDraftEntryResponse(
            result.workspaceId(),
            result.packId(),
            result.versionId(),
            result.packName(),
            result.versionNo()));
  }
}
