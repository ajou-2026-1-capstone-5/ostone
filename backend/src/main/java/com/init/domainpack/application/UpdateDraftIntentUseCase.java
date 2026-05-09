package com.init.domainpack.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.exception.DomainPackVersionInvalidStateException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.IntentDefinitionNotFoundException;
import com.init.domainpack.application.exception.IntentRevisionTargetNotPublishedException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateDraftIntentUseCase {

  private final DomainPackValidator validator;
  private final DomainPackVersionRepository versionRepository;
  private final IntentDefinitionRepository intentRepository;
  private final ObjectMapper objectMapper;

  public UpdateDraftIntentUseCase(
      DomainPackValidator validator,
      DomainPackVersionRepository versionRepository,
      IntentDefinitionRepository intentRepository,
      ObjectMapper objectMapper) {
    this.validator = validator;
    this.versionRepository = versionRepository;
    this.intentRepository = intentRepository;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public IntentDefinitionDetail execute(UpdateDraftIntentCommand command) {
    validator.validateWorkspaceAccess(command.workspaceId(), command.userId());
    validator.validateDomainPack(command.packId(), command.workspaceId());

    DomainPackVersion version =
        versionRepository
            .findById(command.draftVersionId())
            .orElseThrow(() -> new DomainPackVersionNotFoundException(command.draftVersionId()));
    if (!version.getDomainPackId().equals(command.packId())) {
      throw new DomainPackVersionNotFoundException(command.draftVersionId());
    }
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionInvalidStateException("DRAFT 상태의 version에서만 수행할 수 있습니다.");
    }

    IntentDefinition intent =
        intentRepository
            .findByIdAndDomainPackVersionId(command.intentId(), command.draftVersionId())
            .orElseThrow(
                () ->
                    new IntentDefinitionNotFoundException(
                        command.intentId(), command.draftVersionId()));
    if (!IntentDefinition.STATUS_PUBLISHED.equals(intent.getStatus())) {
      throw new IntentRevisionTargetNotPublishedException(command.intentId());
    }

    validateJsonObject(command.entryConditionJson(), "entryConditionJson");
    validateJsonObject(command.metaJson(), "metaJson");
    try {
      intent.reviseDefinition(
          command.name(),
          command.description(),
          command.taxonomyLevel(),
          command.entryConditionJson(),
          command.metaJson());
    } catch (IllegalArgumentException ex) {
      throw new BadRequestException("VALIDATION_ERROR", ex.getMessage(), ex);
    }
    return IntentDefinitionDetail.from(intentRepository.save(intent));
  }

  private void validateJsonObject(String value, String fieldName) {
    if (value == null) {
      return;
    }
    try {
      if (!objectMapper.readTree(value).isObject()) {
        throw new BadRequestException("VALIDATION_ERROR", fieldName + "은 JSON object 문자열이어야 합니다.");
      }
    } catch (JsonProcessingException ex) {
      throw new BadRequestException("VALIDATION_ERROR", fieldName + "은 유효한 JSON이어야 합니다.", ex);
    }
  }
}
