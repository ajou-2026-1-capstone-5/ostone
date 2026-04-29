package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetDomainPackVersionDetailUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;

  public GetDomainPackVersionDetailUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository) {
    this.validator = validator;
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
  }

  public DomainPackVersionDetailResult execute(GetDomainPackVersionDetailQuery query) {
    validator.validateForWorkspacePackVersion(
        query.workspaceId(), query.userId(), query.packId(), query.versionId());

    DomainPackVersion version =
        domainPackVersionRepository
            .findByIdAndWorkspaceId(query.workspaceId(), query.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(query.versionId()));

    return new DomainPackVersionDetailResult(
        version.getId(),
        version.getDomainPackId(),
        version.getVersionNo(),
        version.getLifecycleStatus(),
        version.getSourcePipelineJobId(),
        version.getSummaryJson(),
        intentDefinitionRepository.countByDomainPackVersionId(version.getId()),
        slotDefinitionRepository.countByDomainPackVersionId(version.getId()),
        policyDefinitionRepository.countByDomainPackVersionId(version.getId()),
        riskDefinitionRepository.countByDomainPackVersionId(version.getId()),
        workflowDefinitionRepository.countByDomainPackVersionId(version.getId()),
        version.getCreatedAt(),
        version.getUpdatedAt());
  }
}
