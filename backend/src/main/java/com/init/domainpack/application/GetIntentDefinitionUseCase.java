package com.init.domainpack.application;

import com.init.domainpack.application.exception.IntentDefinitionNotFoundException;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetIntentDefinitionUseCase {

  private final DomainPackValidator validator;
  private final IntentDefinitionRepository intentDefinitionRepository;

  public GetIntentDefinitionUseCase(
      DomainPackValidator validator, IntentDefinitionRepository intentDefinitionRepository) {
    this.validator = validator;
    this.intentDefinitionRepository = intentDefinitionRepository;
  }

  public IntentDefinitionDetail execute(GetIntentDefinitionQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    return intentDefinitionRepository
        .findByIdAndDomainPackVersionId(query.intentId(), query.versionId())
        .map(IntentDefinitionDetail::from)
        .orElseThrow(
            () -> new IntentDefinitionNotFoundException(query.intentId(), query.versionId()));
  }
}
