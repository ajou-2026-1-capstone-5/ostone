package com.init.domainpack.application;

import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetRiskDefinitionListUseCase {

  private final DomainPackValidator validator;
  private final RiskDefinitionRepository riskDefinitionRepository;

  public GetRiskDefinitionListUseCase(
      DomainPackValidator validator, RiskDefinitionRepository riskDefinitionRepository) {
    this.validator = validator;
    this.riskDefinitionRepository = riskDefinitionRepository;
  }

  public List<RiskDefinitionSummary> execute(GetRiskDefinitionListQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    return riskDefinitionRepository
        .findAllByDomainPackVersionIdOrderByRiskCodeAsc(query.versionId())
        .stream()
        .map(RiskDefinitionSummary::from)
        .toList();
  }
}
