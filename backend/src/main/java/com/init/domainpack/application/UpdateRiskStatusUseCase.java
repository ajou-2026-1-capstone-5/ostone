package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateRiskStatusUseCase {

  private final DomainPackValidator validator;
  private final RiskDefinitionRepository riskRepository;
  private final DomainPackVersionRepository versionRepository;

  public UpdateRiskStatusUseCase(
      DomainPackValidator validator,
      RiskDefinitionRepository riskRepository,
      DomainPackVersionRepository versionRepository) {
    this.validator = validator;
    this.riskRepository = riskRepository;
    this.versionRepository = versionRepository;
  }

  @Transactional
  public RiskDefinitionResponse execute(UpdateRiskStatusCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.requesterId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findById(command.versionId())
            .orElseThrow(
                () -> new NotFoundException("NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId()));

    if (!version.getDomainPackId().equals(command.packId())) {
      throw new NotFoundException("NOT_FOUND", "버전을 찾을 수 없습니다: " + command.versionId());
    }

    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new BadRequestException("RISK_NOT_EDITABLE", "DRAFT 상태의 버전에서만 위험요소를 수정할 수 있습니다.");
    }

    RiskDefinition risk = riskRepository.findByIdOrThrow(command.riskId());

    if (!risk.getDomainPackVersionId().equals(command.versionId())) {
      throw new NotFoundException("NOT_FOUND", "위험요소를 찾을 수 없습니다: " + command.riskId());
    }

    try {
      risk.changeStatus(command.status());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    riskRepository.save(risk);
    return RiskDefinitionResponse.from(risk);
  }
}
