package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.model.WorkspaceMemberRole;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import com.init.domainpack.infrastructure.persistence.JpaIntentDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaIntentSlotBindingRepository;
import com.init.domainpack.infrastructure.persistence.JpaIntentWorkflowBindingRepository;
import com.init.domainpack.infrastructure.persistence.JpaPolicyDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaRiskDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaSlotDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaWorkflowDefinitionRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class CreateDomainPackDraftUseCase {

  private static final Set<WorkspaceMemberRole> ALLOWED_WORKSPACE_ROLES =
      Set.of(WorkspaceMemberRole.OPERATOR, WorkspaceMemberRole.ADMIN);

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackRepository domainPackRepository;
  private final JpaIntentDefinitionRepository intentDefinitionRepository;
  private final JpaSlotDefinitionRepository slotDefinitionRepository;
  private final JpaPolicyDefinitionRepository policyDefinitionRepository;
  private final JpaRiskDefinitionRepository riskDefinitionRepository;
  private final JpaWorkflowDefinitionRepository workflowDefinitionRepository;
  private final JpaIntentSlotBindingRepository intentSlotBindingRepository;
  private final JpaIntentWorkflowBindingRepository intentWorkflowBindingRepository;
  private final WorkspaceExistencePort workspaceExistencePort;
  private final WorkspaceMembershipPort workspaceMembershipPort;

  public CreateDomainPackDraftUseCase(
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackRepository domainPackRepository,
      JpaIntentDefinitionRepository intentDefinitionRepository,
      JpaSlotDefinitionRepository slotDefinitionRepository,
      JpaPolicyDefinitionRepository policyDefinitionRepository,
      JpaRiskDefinitionRepository riskDefinitionRepository,
      JpaWorkflowDefinitionRepository workflowDefinitionRepository,
      JpaIntentSlotBindingRepository intentSlotBindingRepository,
      JpaIntentWorkflowBindingRepository intentWorkflowBindingRepository,
      WorkspaceExistencePort workspaceExistencePort,
      WorkspaceMembershipPort workspaceMembershipPort) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackRepository = domainPackRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.intentWorkflowBindingRepository = intentWorkflowBindingRepository;
    this.workspaceExistencePort = workspaceExistencePort;
    this.workspaceMembershipPort = workspaceMembershipPort;
  }

  public CreateDomainPackDraftResult execute(CreateDomainPackDraftCommand command) {
    validateWorkspaceAccess(command);
    validateDomainPack(command);
    validateDraftPayload(command);

    int nextVersionNo =
        domainPackVersionRepository.findMaxVersionNoByDomainPackId(command.packId()).orElse(0) + 1;

    DomainPackVersion draftVersion =
        DomainPackVersion.createDraft(
            command.packId(),
            nextVersionNo,
            command.userId(),
            command.sourcePipelineJobId(),
            command.summaryJson());

    DomainPackVersion savedVersion;
    try {
      savedVersion = domainPackVersionRepository.saveAndFlush(draftVersion);
    } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException ex) {
      throw new DomainPackVersionConflictException(command.packId());
    }

    List<IntentDefinition> intents =
        intentDefinitionRepository.saveAll(
            safeList(command.intents()).stream()
                .map(
                    intent ->
                        IntentDefinition.create(
                            savedVersion.getId(),
                            intent.intentCode(),
                            intent.name(),
                            intent.description(),
                            intent.taxonomyLevel(),
                            intent.sourceClusterRef(),
                            intent.entryConditionJson(),
                            intent.evidenceJson(),
                            intent.metaJson()))
                .toList());
    Map<String, IntentDefinition> intentsByCode =
        indexByCode(intents, IntentDefinition::getIntentCode);

    boolean hasParentIntent = false;
    for (CreateDomainPackDraftCommand.IntentDraft draft : safeList(command.intents())) {
      if (draft.parentIntentCode() == null || draft.parentIntentCode().isBlank()) {
        continue;
      }
      hasParentIntent = true;
      IntentDefinition child = requireByCode(intentsByCode, draft.intentCode(), "intent");
      IntentDefinition parent = intentsByCode.get(draft.parentIntentCode());
      if (parent == null) {
        throw new DomainPackDraftRequestInvalidException(
            "parentIntentCode를 찾을 수 없습니다. intentCode="
                + draft.intentCode()
                + ", parentIntentCode="
                + draft.parentIntentCode());
      }
      child.setParentIntentId(parent.getId());
    }
    if (hasParentIntent) {
      intentDefinitionRepository.saveAll(intents);
    }

    List<SlotDefinition> slots =
        slotDefinitionRepository.saveAll(
            safeList(command.slots()).stream()
                .map(
                    slot ->
                        SlotDefinition.create(
                            savedVersion.getId(),
                            slot.slotCode(),
                            slot.name(),
                            slot.description(),
                            slot.dataType(),
                            slot.isSensitive(),
                            slot.validationRuleJson(),
                            slot.defaultValueJson(),
                            slot.metaJson()))
                .toList());
    Map<String, SlotDefinition> slotsByCode = indexByCode(slots, SlotDefinition::getSlotCode);

    List<PolicyDefinition> policies =
        policyDefinitionRepository.saveAll(
            safeList(command.policies()).stream()
                .map(
                    policy ->
                        PolicyDefinition.create(
                            savedVersion.getId(),
                            policy.policyCode(),
                            policy.name(),
                            policy.description(),
                            policy.severity(),
                            policy.conditionJson(),
                            policy.actionJson(),
                            policy.evidenceJson(),
                            policy.metaJson()))
                .toList());

    List<RiskDefinition> risks =
        riskDefinitionRepository.saveAll(
            safeList(command.risks()).stream()
                .map(
                    risk ->
                        RiskDefinition.create(
                            savedVersion.getId(),
                            risk.riskCode(),
                            risk.name(),
                            risk.description(),
                            risk.riskLevel(),
                            risk.triggerConditionJson(),
                            risk.handlingActionJson(),
                            risk.evidenceJson(),
                            risk.metaJson()))
                .toList());

    List<WorkflowDefinition> workflows =
        workflowDefinitionRepository.saveAll(
            safeList(command.workflows()).stream()
                .map(
                    workflow ->
                        WorkflowDefinition.create(
                            savedVersion.getId(),
                            workflow.workflowCode(),
                            workflow.name(),
                            workflow.description(),
                            workflow.graphJson(),
                            workflow.initialState(),
                            workflow.terminalStatesJson(),
                            workflow.evidenceJson(),
                            workflow.metaJson()))
                .toList());
    Map<String, WorkflowDefinition> workflowsByCode =
        indexByCode(workflows, WorkflowDefinition::getWorkflowCode);

    intentSlotBindingRepository.saveAll(
        safeList(command.intentSlotBindings()).stream()
            .map(
                binding ->
                    IntentSlotBinding.create(
                        requireByCode(intentsByCode, binding.intentCode(), "intent").getId(),
                        requireByCode(slotsByCode, binding.slotCode(), "slot").getId(),
                        binding.isRequired(),
                        binding.collectionOrder(),
                        binding.promptHint(),
                        binding.conditionJson()))
            .toList());

    intentWorkflowBindingRepository.saveAll(
        safeList(command.intentWorkflowBindings()).stream()
            .map(
                binding ->
                    IntentWorkflowBinding.create(
                        requireByCode(intentsByCode, binding.intentCode(), "intent").getId(),
                        requireByCode(workflowsByCode, binding.workflowCode(), "workflow").getId(),
                        binding.isPrimary(),
                        binding.routeConditionJson()))
            .toList());

    return CreateDomainPackDraftResult.from(
        savedVersion,
        intents.size(),
        slots.size(),
        policies.size(),
        risks.size(),
        workflows.size());
  }

  private void validateWorkspaceAccess(CreateDomainPackDraftCommand command) {
    if (!workspaceExistencePort.existsById(command.workspaceId())) {
      throw new DomainPackWorkspaceNotFoundException(
          "워크스페이스를 찾을 수 없습니다. id=" + command.workspaceId());
    }

    if (!workspaceMembershipPort.hasAnyRole(
        command.workspaceId(), command.userId(), ALLOWED_WORKSPACE_ROLES)) {
      throw new DomainPackUnauthorizedWorkspaceAccessException(
          "워크스페이스에 접근 권한이 없습니다. workspaceId=" + command.workspaceId());
    }
  }

  private void validateDomainPack(CreateDomainPackDraftCommand command) {
    if (!domainPackRepository.existsByIdAndWorkspaceId(command.packId(), command.workspaceId())) {
      throw new DomainPackNotFoundException(command.packId());
    }
  }

  private void validateDraftPayload(CreateDomainPackDraftCommand command) {
    ensureUnique(
        safeList(command.intents()),
        CreateDomainPackDraftCommand.IntentDraft::intentCode,
        "intentCode");
    ensureUnique(
        safeList(command.slots()), CreateDomainPackDraftCommand.SlotDraft::slotCode, "slotCode");
    ensureUnique(
        safeList(command.policies()),
        CreateDomainPackDraftCommand.PolicyDraft::policyCode,
        "policyCode");
    ensureUnique(
        safeList(command.risks()), CreateDomainPackDraftCommand.RiskDraft::riskCode, "riskCode");
    ensureUnique(
        safeList(command.workflows()),
        CreateDomainPackDraftCommand.WorkflowDraft::workflowCode,
        "workflowCode");

    ensureUnique(
        safeList(command.intentSlotBindings()),
        binding -> binding.intentCode() + "::" + binding.slotCode(),
        "intentSlotBinding");
    ensureUnique(
        safeList(command.intentWorkflowBindings()),
        binding -> binding.intentCode() + "::" + binding.workflowCode(),
        "intentWorkflowBinding");
  }

  private <T> List<T> safeList(List<T> list) {
    return list == null ? List.of() : list;
  }

  private <T> void ensureUnique(List<T> items, Function<T, String> keyExtractor, String fieldName) {
    Map<String, Boolean> seen = new LinkedHashMap<>();
    for (T item : items) {
      String key = keyExtractor.apply(item);
      if (key == null || key.isBlank()) {
        throw new DomainPackDraftRequestInvalidException(fieldName + "는 비어 있을 수 없습니다.");
      }
      if (seen.put(key, Boolean.TRUE) != null) {
        throw new DomainPackDraftRequestInvalidException(
            "중복된 " + fieldName + " 값이 존재합니다. value=" + key);
      }
    }
  }

  private <T> Map<String, T> indexByCode(List<T> items, Function<T, String> codeExtractor) {
    Map<String, T> indexed = new LinkedHashMap<>();
    for (T item : items) {
      indexed.put(codeExtractor.apply(item), item);
    }
    return indexed;
  }

  private <T> T requireByCode(Map<String, T> indexed, String code, String resourceName) {
    T resource = indexed.get(code);
    if (resource == null) {
      throw new DomainPackDraftRequestInvalidException(
          resourceName + " 참조를 찾을 수 없습니다. code=" + Objects.toString(code));
    }
    return resource;
  }
}
