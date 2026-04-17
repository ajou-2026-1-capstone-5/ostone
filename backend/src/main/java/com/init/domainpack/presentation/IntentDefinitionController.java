package com.init.domainpack.presentation;

import com.init.domainpack.application.GetIntentDefinitionListQuery;
import com.init.domainpack.application.GetIntentDefinitionListUseCase;
import com.init.domainpack.application.GetIntentDefinitionQuery;
import com.init.domainpack.application.GetIntentDefinitionUseCase;
import com.init.domainpack.application.IntentDefinitionDetail;
import com.init.domainpack.application.IntentDefinitionSummary;
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
    "/api/v1/workspaces/{workspaceId}/domain-packs/{packId}/versions/{versionId}/intents")
public class IntentDefinitionController {

  private final GetIntentDefinitionListUseCase listUseCase;
  private final GetIntentDefinitionUseCase detailUseCase;

  public IntentDefinitionController(
      GetIntentDefinitionListUseCase listUseCase, GetIntentDefinitionUseCase detailUseCase) {
    this.listUseCase = listUseCase;
    this.detailUseCase = detailUseCase;
  }

  @GetMapping
  public ResponseEntity<List<IntentDefinitionSummary>> listIntents(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    List<IntentDefinitionSummary> result =
        listUseCase.execute(
            new GetIntentDefinitionListQuery(workspaceId, packId, versionId, userId));
    return ResponseEntity.ok(result);
  }

  @GetMapping("/{intentId}")
  public ResponseEntity<IntentDefinitionDetail> getIntent(
      @PathVariable Long workspaceId,
      @PathVariable Long packId,
      @PathVariable Long versionId,
      @PathVariable Long intentId,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    IntentDefinitionDetail result =
        detailUseCase.execute(
            new GetIntentDefinitionQuery(workspaceId, packId, versionId, intentId, userId));
    return ResponseEntity.ok(result);
  }
}
