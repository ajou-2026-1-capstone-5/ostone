package com.init.domainpack.application;

import com.init.domainpack.domain.repository.DomainPackRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetDomainPackListUseCase {

  private final DomainPackValidator validator;
  private final DomainPackRepository domainPackRepository;

  public GetDomainPackListUseCase(
      DomainPackValidator validator, DomainPackRepository domainPackRepository) {
    this.validator = validator;
    this.domainPackRepository = domainPackRepository;
  }

  public List<DomainPackSummaryResult> execute(GetDomainPackListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());

    return domainPackRepository.findByWorkspaceId(query.workspaceId()).stream()
        .map(DomainPackSummaryResult::from)
        .toList();
  }
}
