package com.init.domainpack.application;

import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetPolicyDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final PolicyDefinitionRepository policyDefinitionRepository;

  public GetPolicyDefinitionListUseCase(
      DomainPackValidator validator, PolicyDefinitionRepository policyDefinitionRepository) {
    this.validator = validator;
    this.policyDefinitionRepository = policyDefinitionRepository;
  }

  public List<PolicyDefinitionSummary> execute(GetPolicyDefinitionListQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return policyDefinitionRepository
        .findAllByDomainPackVersionIdOrderByPolicyCodeAsc(query.versionId())
        .stream()
        .map(PolicyDefinitionSummary::from)
        .toList();
  }
}
