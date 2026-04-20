package com.init.domainpack.application;

import com.init.domainpack.application.exception.PolicyDefinitionNotFoundException;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetPolicyDefinitionUseCase {

  private final DomainPackValidator validator;
  private final PolicyDefinitionRepository policyDefinitionRepository;

  public GetPolicyDefinitionUseCase(
      DomainPackValidator validator, PolicyDefinitionRepository policyDefinitionRepository) {
    this.validator = validator;
    this.policyDefinitionRepository = policyDefinitionRepository;
  }

  public PolicyDefinitionResponse execute(GetPolicyDefinitionQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return policyDefinitionRepository
        .findByIdAndDomainPackVersionId(query.policyId(), query.versionId())
        .map(PolicyDefinitionResponse::from)
        .orElseThrow(() -> new PolicyDefinitionNotFoundException(query.policyId()));
  }
}
