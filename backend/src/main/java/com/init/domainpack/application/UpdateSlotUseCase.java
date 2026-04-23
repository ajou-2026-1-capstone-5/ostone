package com.init.domainpack.application;

import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class UpdateSlotUseCase {

  private final DomainPackValidator validator;
  private final SlotDefinitionRepository slotRepository;
  private final DomainPackVersionRepository versionRepository;

  public UpdateSlotUseCase(
      DomainPackValidator validator,
      SlotDefinitionRepository slotRepository,
      DomainPackVersionRepository versionRepository) {
    this.validator = validator;
    this.slotRepository = slotRepository;
    this.versionRepository = versionRepository;
  }

  @Transactional
  public SlotDefinitionResponse execute(UpdateSlotCommand command) {
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
      throw new BadRequestException("SLOT_NOT_EDITABLE", "DRAFT 상태의 버전에서만 슬롯을 수정할 수 있습니다.");
    }

    SlotDefinition slot = slotRepository.findByIdOrThrow(command.slotId());

    if (!slot.getDomainPackVersionId().equals(command.versionId())) {
      throw new NotFoundException("NOT_FOUND", "슬롯을 찾을 수 없습니다: " + command.slotId());
    }

    try {
      slot.updateFields(
          command.name(),
          command.description(),
          command.isSensitive(),
          command.validationRuleJson(),
          command.defaultValueJson(),
          command.metaJson());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("VALIDATION_ERROR", e.getMessage());
    }

    slotRepository.save(slot);
    return SlotDefinitionResponse.from(slot);
  }
}
