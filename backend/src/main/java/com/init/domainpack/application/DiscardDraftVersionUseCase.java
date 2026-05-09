package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftInUseException;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionReferencePort;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class DiscardDraftVersionUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final DomainPackVersionReferencePort referencePort;

  public DiscardDraftVersionUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      DomainPackVersionReferencePort referencePort) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.referencePort = referencePort;
  }

  @Transactional
  public void execute(DiscardDraftVersionCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.userId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findByIdForUpdate(command.draftVersionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.draftVersionId()));
    if (!version.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.draftVersionId());
    }
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionInvalidStateException("DRAFT 상태의 version에서만 수행할 수 있습니다.");
    }
    if (referencePort.existsExternalReference(version.getId())) {
      throw new DomainPackDraftInUseException(version.getId());
    }
    try {
      versionRepository.delete(version);
      versionRepository.flush();
    } catch (DataIntegrityViolationException ex) {
      throw new DomainPackDraftInUseException(version.getId(), ex);
    }
  }
}
