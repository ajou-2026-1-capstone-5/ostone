package com.init.domainpack.application;

import com.init.domainpack.application.exception.SlotDefinitionNotFoundException;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetSlotDefinitionUseCase {

  private final DomainPackValidator validator;
  private final SlotDefinitionRepository slotDefinitionRepository;

  public GetSlotDefinitionUseCase(
      DomainPackValidator validator, SlotDefinitionRepository slotDefinitionRepository) {
    this.validator = validator;
    this.slotDefinitionRepository = slotDefinitionRepository;
  }

  public SlotDefinitionResponse execute(GetSlotDefinitionQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return slotDefinitionRepository
        .findByIdAndDomainPackVersionId(query.slotId(), query.versionId())
        .map(SlotDefinitionResponse::from)
        .orElseThrow(() -> new SlotDefinitionNotFoundException(query.slotId()));
  }
}
