package com.init.domainpack.presentation;

import com.init.domainpack.application.DomainPackDetailResult;
import com.init.domainpack.application.DomainPackSummaryResult;
import com.init.domainpack.application.DomainPackVersionDetailResult;
import com.init.domainpack.application.GetDomainPackDetailQuery;
import com.init.domainpack.application.GetDomainPackDetailUseCase;
import com.init.domainpack.application.GetDomainPackListQuery;
import com.init.domainpack.application.GetDomainPackListUseCase;
import com.init.domainpack.application.GetDomainPackVersionDetailQuery;
import com.init.domainpack.application.GetDomainPackVersionDetailUseCase;
import com.init.shared.presentation.AuthenticationUtils;
import java.util.List;
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
  private final GetDomainPackListUseCase packListUseCase;
  private final GetDomainPackVersionDetailUseCase versionDetailUseCase;

  public DomainPackController(
      GetDomainPackDetailUseCase packDetailUseCase,
      GetDomainPackListUseCase packListUseCase,
      GetDomainPackVersionDetailUseCase versionDetailUseCase) {
    this.packDetailUseCase = packDetailUseCase;
    this.packListUseCase = packListUseCase;
    this.versionDetailUseCase = versionDetailUseCase;
  }

  @GetMapping
  public ResponseEntity<List<DomainPackSummaryResult>> listDomainPacks(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        packListUseCase.execute(new GetDomainPackListQuery(workspaceId, userId)));
  }

  @GetMapping("/{packId}")
  public ResponseEntity<DomainPackDetailResult> getDomainPack(
      @PathVariable Long workspaceId, @PathVariable Long packId, Authentication authentication) {
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
