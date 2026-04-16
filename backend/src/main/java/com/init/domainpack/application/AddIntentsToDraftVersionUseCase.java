package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 기존 DRAFT 버전에 intent를 추가 저장한다. Airflow 파이프라인 콜백의 2단계에서 사용한다. */
@Service
@Transactional
public class AddIntentsToDraftVersionUseCase {

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackDraftPersistenceService domainPackDraftPersistenceService;

  public AddIntentsToDraftVersionUseCase(
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackDraftPersistenceService domainPackDraftPersistenceService) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackDraftPersistenceService = domainPackDraftPersistenceService;
  }

  public AddIntentsToDraftVersionResult execute(AddIntentsToDraftVersionCommand command) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findById(command.domainPackVersionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_VERSION_NOT_FOUND",
                        "Domain pack version을 찾을 수 없습니다. id=" + command.domainPackVersionId()));

    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionNotDraftException(command.domainPackVersionId());
    }

    return domainPackDraftPersistenceService.persistIntents(
        command.domainPackVersionId(), command.intents());
  }
}
