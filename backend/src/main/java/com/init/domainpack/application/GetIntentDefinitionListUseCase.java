package com.init.domainpack.application;

import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetIntentDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final IntentDefinitionRepository intentDefinitionRepository;

  public GetIntentDefinitionListUseCase(
      DomainPackValidator validator, IntentDefinitionRepository intentDefinitionRepository) {
    this.validator = validator;
    this.intentDefinitionRepository = intentDefinitionRepository;
  }

  public List<IntentDefinitionSummary> execute(GetIntentDefinitionListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    return intentDefinitionRepository.findByDomainPackVersionId(query.versionId()).stream()
        .map(IntentDefinitionSummary::from)
        .toList();
  }
}
