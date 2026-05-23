package com.init.domainpack.application;

import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetDomainPackListUseCase {

  private final DomainPackValidator validator;
  private final DomainPackRepository domainPackRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;

  public GetDomainPackListUseCase(
      DomainPackValidator validator,
      DomainPackRepository domainPackRepository,
      DomainPackVersionRepository domainPackVersionRepository) {
    this.validator = validator;
    this.domainPackRepository = domainPackRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
  }

  public List<DomainPackSummaryResult> execute(GetDomainPackListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    var currentWorkspaceVersion =
        domainPackVersionRepository.findCurrentPublishedByWorkspaceId(query.workspaceId());

    return domainPackRepository.findByWorkspaceId(query.workspaceId()).stream()
        .map(
            pack ->
                DomainPackSummaryResult.from(
                    pack,
                    currentWorkspaceVersion
                        .filter(version -> version.getDomainPackId().equals(pack.getId()))
                        .orElse(null)))
        .toList();
  }
}
