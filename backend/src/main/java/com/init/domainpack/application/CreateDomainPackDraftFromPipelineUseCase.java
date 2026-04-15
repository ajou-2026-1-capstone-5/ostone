package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPack;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackCommandRepository;
import java.util.Optional;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Airflow 파이프라인 콜백에서 DomainPack(없으면 생성) + DRAFT Version을 생성한다. Intent는 별도 API에서 추가한다. */
@Service
@Transactional
public class CreateDomainPackDraftFromPipelineUseCase {

  private final DomainPackCommandRepository domainPackCommandRepository;
  private final DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  public CreateDomainPackDraftFromPipelineUseCase(
      DomainPackCommandRepository domainPackCommandRepository,
      DomainPackDraftPersistenceService domainPackDraftPersistenceService) {
    this.domainPackCommandRepository = domainPackCommandRepository;
    this.domainPackDraftPersistenceService = domainPackDraftPersistenceService;
  }

  public CreateDomainPackDraftFromPipelineResult execute(
      CreateDomainPackDraftFromPipelineCommand command) {
    DomainPackResolution resolution = resolveDomainPack(command);

    DomainPackVersion savedVersion =
        domainPackDraftPersistenceService.persistVersion(
            resolution.domainPack().getId(),
            null,
            command.sourcePipelineJobId(),
            command.summaryJson());

    return new CreateDomainPackDraftFromPipelineResult(
        resolution.domainPack().getId(),
        savedVersion.getId(),
        savedVersion.getVersionNo(),
        resolution.domainPack().getPackKey(),
        resolution.createdPack(),
        savedVersion.getSourcePipelineJobId());
  }

  private DomainPackResolution resolveDomainPack(CreateDomainPackDraftFromPipelineCommand command) {
    Optional<DomainPack> existing =
        domainPackCommandRepository.findByWorkspaceIdAndPackKey(
            command.workspaceId(), command.packKey());
    if (existing.isPresent()) {
      return new DomainPackResolution(existing.get(), false);
    }

    DomainPack domainPack =
        DomainPack.create(command.workspaceId(), command.packKey(), command.packName(), null, null);
    try {
      return new DomainPackResolution(domainPackCommandRepository.saveAndFlush(domainPack), true);
    } catch (DataIntegrityViolationException ex) {
      DomainPack resolved =
          domainPackCommandRepository
              .findByWorkspaceIdAndPackKey(command.workspaceId(), command.packKey())
              .orElseThrow(() -> ex);
      return new DomainPackResolution(resolved, false);
    }
  }

  private record DomainPackResolution(DomainPack domainPack, boolean createdPack) {}
}
