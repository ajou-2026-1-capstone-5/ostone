package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetIntentDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;

  public GetIntentDefinitionListUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository) {
    this.validator = validator;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
  }

  public List<IntentDefinitionSummary> execute(GetIntentDefinitionListQuery query) {
    validator.validateWorkspaceAccess(query.workspaceId(), query.userId());
    validator.validateDomainPack(query.packId(), query.workspaceId());
    validator.validateVersion(query.versionId(), query.packId());

    DomainPackVersion version =
        domainPackVersionRepository
            .findById(query.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(query.versionId()));
    List<IntentDefinition> intents =
        DomainPackVersion.STATUS_PUBLISHED.equals(version.getLifecycleStatus())
            ? intentDefinitionRepository.findByDomainPackVersionIdAndStatus(
                query.versionId(), IntentDefinition.STATUS_PUBLISHED)
            : intentDefinitionRepository.findByDomainPackVersionIdAndStatusNot(
                query.versionId(), IntentDefinition.STATUS_REJECTED);

    return intents.stream().map(IntentDefinitionSummary::from).toList();
  }
}
