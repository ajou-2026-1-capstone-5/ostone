package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackCurrentVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotCurrentException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CreateIntentRevisionDraftUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final DomainPackVersionCloneService cloneService;

  public CreateIntentRevisionDraftUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      DomainPackVersionCloneService cloneService) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.cloneService = cloneService;
  }

  @Transactional
  public IntentRevisionDraftResult execute(CreateIntentRevisionDraftCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.userId());
    validator.lockDomainPack(command.packId(), command.workspaceId());
    validateReason(command.reason());

    DomainPackVersion baseVersion =
        versionRepository
            .findById(command.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.versionId()));
    if (!baseVersion.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.versionId());
    }
    if (!DomainPackVersion.STATUS_PUBLISHED.equals(baseVersion.getLifecycleStatus())) {
      throw new DomainPackVersionInvalidStateException("PUBLISHED 상태의 version에서만 수행할 수 있습니다.");
    }

    DomainPackVersion current =
        versionRepository
            .findCurrentPublishedByDomainPackId(command.packId())
            .orElseThrow(() -> new DomainPackCurrentVersionNotFoundException(command.packId()));
    if (!current.getId().equals(baseVersion.getId())) {
      throw new DomainPackVersionNotCurrentException(command.versionId());
    }

    DomainPackVersionCloneResult result =
        cloneService.cloneVersion(
            new DomainPackVersionCloneCommand(
                command.workspaceId(),
                command.packId(),
                baseVersion,
                command.userId(),
                DomainPackDraftSourceType.INTENT_REVISION,
                command.reason()));
    return IntentRevisionDraftResult.from(result);
  }

  private void validateReason(String reason) {
    if (reason != null && reason.length() > 1000) {
      throw new BadRequestException("VALIDATION_ERROR", "reason은 1000자 이하여야 합니다.");
    }
  }
}
