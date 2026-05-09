package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackCurrentVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.RestoreSourceNotPreviousPublishedException;
import com.init.domainpack.application.exception.RestoreSourceNotPublishedException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CreateRestoreDraftUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final DomainPackVersionCloneService cloneService;

  public CreateRestoreDraftUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      DomainPackVersionCloneService cloneService) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.cloneService = cloneService;
  }

  @Transactional
  public RestoreDraftResult execute(CreateRestoreDraftCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.userId());
    DomainPackDraftReasonValidator.validate(command.reason());
    validator.lockDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion baseVersion =
        versionRepository
            .findById(command.versionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.versionId()));
    if (!baseVersion.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.versionId());
    }
    if (!DomainPackVersion.STATUS_PUBLISHED.equals(baseVersion.getLifecycleStatus())) {
      throw new RestoreSourceNotPublishedException(command.versionId());
    }

    DomainPackVersion current =
        versionRepository
            .findCurrentPublishedByDomainPackId(command.packId())
            .orElseThrow(() -> new DomainPackCurrentVersionNotFoundException(command.packId()));
    if (baseVersion.getVersionNo() >= current.getVersionNo()) {
      throw new RestoreSourceNotPreviousPublishedException(command.versionId());
    }

    DomainPackVersionCloneResult result =
        cloneService.cloneVersion(
            new DomainPackVersionCloneCommand(
                command.workspaceId(),
                command.packId(),
                baseVersion,
                command.userId(),
                DomainPackDraftSourceType.RESTORE,
                command.reason()));
    return RestoreDraftResult.from(result);
  }
}
