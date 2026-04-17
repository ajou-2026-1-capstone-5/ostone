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
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    return slotDefinitionRepository
        .findByIdAndDomainPackVersionId(query.slotId(), query.versionId())
        .map(SlotDefinitionResponse::from)
        .orElseThrow(() -> new SlotDefinitionNotFoundException(query.slotId()));
  }
}
