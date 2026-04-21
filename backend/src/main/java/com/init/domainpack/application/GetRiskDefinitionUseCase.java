package com.init.domainpack.application;

import com.init.domainpack.application.exception.RiskDefinitionNotFoundException;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetRiskDefinitionUseCase {

  private final DomainPackValidator validator;
  private final RiskDefinitionRepository riskDefinitionRepository;

  public GetRiskDefinitionUseCase(
      DomainPackValidator validator, RiskDefinitionRepository riskDefinitionRepository) {
    this.validator = validator;
    this.riskDefinitionRepository = riskDefinitionRepository;
  }

  public RiskDefinitionResponse execute(GetRiskDefinitionQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return riskDefinitionRepository
        .findByIdAndDomainPackVersionId(query.riskId(), query.versionId())
        .map(RiskDefinitionResponse::from)
        .orElseThrow(() -> new RiskDefinitionNotFoundException(query.riskId()));
  }
}
