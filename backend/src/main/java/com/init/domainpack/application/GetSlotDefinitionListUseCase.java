package com.init.domainpack.application;

import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetSlotDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final SlotDefinitionRepository slotDefinitionRepository;

  public GetSlotDefinitionListUseCase(
      DomainPackValidator validator, SlotDefinitionRepository slotDefinitionRepository) {
    this.validator = validator;
    this.slotDefinitionRepository = slotDefinitionRepository;
  }

  public List<SlotDefinitionSummary> execute(GetSlotDefinitionListQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return slotDefinitionRepository
        .findAllByDomainPackVersionIdOrderBySlotCodeAsc(query.versionId())
        .stream()
        .map(SlotDefinitionSummary::from)
        .toList();
  }
}
