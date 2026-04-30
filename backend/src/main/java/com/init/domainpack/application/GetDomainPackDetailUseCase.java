package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetDomainPackDetailUseCase {

  private final DomainPackValidator validator;
  private final DomainPackRepository domainPackRepository;
  private final DomainPackVersionRepository domainPackVersionRepository;

  public GetDomainPackDetailUseCase(
      DomainPackValidator validator,
      DomainPackRepository domainPackRepository,
      DomainPackVersionRepository domainPackVersionRepository) {
    this.validator = validator;
    this.domainPackRepository = domainPackRepository;
    this.domainPackVersionRepository = domainPackVersionRepository;
  }

  public DomainPackDetailResult execute(GetDomainPackDetailQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());

    DomainPack pack =
        domainPackRepository
            .findByIdAndWorkspaceId(query.packId(), query.workspaceId())
            .orElseThrow(() -> new DomainPackNotFoundException(query.packId()));

    List<DomainPackVersion> versions =
        domainPackVersionRepository.findAllByDomainPackIdOrderByVersionNoDesc(query.packId());

    return DomainPackDetailResult.from(pack, versions);
  }
}
