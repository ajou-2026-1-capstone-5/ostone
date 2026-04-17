package com.init.domainpack.presentation;

import com.init.domainpack.application.GetSlotDefinitionListQuery;
import com.init.domainpack.application.GetSlotDefinitionListUseCase;
import com.init.domainpack.application.GetSlotDefinitionQuery;
import com.init.domainpack.application.GetSlotDefinitionUseCase;
import com.init.domainpack.application.SlotDefinitionResponse;
import com.init.domainpack.application.SlotDefinitionSummary;
import com.init.shared.presentation.AuthenticationUtils;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/slots")
public class SlotDefinitionController {

  private final GetSlotDefinitionListUseCase listUseCase;
  private final GetSlotDefinitionUseCase detailUseCase;

  public SlotDefinitionController(
      GetSlotDefinitionListUseCase listUseCase, GetSlotDefinitionUseCase detailUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
  }

  @GetMapping
  public ResponseEntity<List<SlotDefinitionSummary>> listSlots(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        listUseCase.execute(
            new GetSlotDefinitionListQuery(workspaceId, packId, versionId, userId)));
  }

  @GetMapping("/{slotId}")
  public ResponseEntity<SlotDefinitionResponse> getSlot(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long slotId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        detailUseCase.execute(
            new GetSlotDefinitionQuery(workspaceId, packId, versionId, slotId, userId)));
  }
}
