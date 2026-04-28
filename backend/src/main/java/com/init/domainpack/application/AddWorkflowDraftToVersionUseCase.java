package com.init.domainpack.application;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AddWorkflowDraftToVersionUseCase {

  private final DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  public AddWorkflowDraftToVersionUseCase(
      DomainPackDraftPersistenceService domainPackDraftPersistenceService) {
    this.domainPackDraftPersistenceService = domainPackDraftPersistenceService;
  }

  public AddWorkflowDraftToVersionResult execute(AddWorkflowDraftToVersionCommand command) {
    return domainPackDraftPersistenceService.persistWorkflowDraft(
        command.domainPackVersionId(),
        command.slots(),
        command.policies(),
        command.risks(),
        command.workflows(),
        command.intentSlotBindings(),
        command.intentWorkflowBindings());
  }
}
