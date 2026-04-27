package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftEntryNotFoundException;
import com.init.domainpack.domain.repository.DomainPackRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetDomainPackDraftEntryUseCase {

  private final DomainPackValidator validator;
  private final DomainPackRepository domainPackRepository;

  public GetDomainPackDraftEntryUseCase(
      DomainPackValidator validator, DomainPackRepository domainPackRepository) {
    this.validator = validator;
    this.domainPackRepository = domainPackRepository;
  }

  public DomainPackDraftEntryResult execute(GetDomainPackDraftEntryQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());

    return domainPackRepository
        .findLatestDraftEntryByWorkspaceId(query.workspaceId())
        .map(DomainPackDraftEntryResult::from)
        .orElseThrow(() -> new DomainPackDraftEntryNotFoundException(query.workspaceId()));
  }
}
