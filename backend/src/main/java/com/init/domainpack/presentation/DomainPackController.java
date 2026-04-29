package com.init.domainpack.presentation;

import com.init.domainpack.application.DomainPackDetailResult;
import com.init.domainpack.application.DomainPackVersionDetailResult;
import com.init.domainpack.application.GetDomainPackDetailQuery;
import com.init.domainpack.application.GetDomainPackDetailUseCase;
import com.init.domainpack.application.GetDomainPackVersionDetailQuery;
import com.init.domainpack.application.GetDomainPackVersionDetailUseCase;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs")
public class DomainPackController {

  private final GetDomainPackDetailUseCase packDetailUseCase;
  private final GetDomainPackVersionDetailUseCase versionDetailUseCase;

  public DomainPackController(
      GetDomainPackDetailUseCase packDetailUseCase,
      GetDomainPackVersionDetailUseCase versionDetailUseCase) {
    this.packDetailUseCase = packDetailUseCase;
    this.versionDetailUseCase = versionDetailUseCase;
  }

  @GetMapping("/{packId}")
  public ResponseEntity<DomainPackDetailResult> getDomainPack(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        packDetailUseCase.execute(new GetDomainPackDetailQuery(workspaceId, packId, userId)));
  }

  @GetMapping("/{packId}/versions/{versionId}")
  public ResponseEntity<DomainPackVersionDetailResult> getDomainPackVersion(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        versionDetailUseCase.execute(
            new GetDomainPackVersionDetailQuery(workspaceId, packId, versionId, userId)));
  }
}
