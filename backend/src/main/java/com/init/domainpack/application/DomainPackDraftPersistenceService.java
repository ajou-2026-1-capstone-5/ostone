package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class DomainPackDraftPersistenceService {

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final IntentWorkflowBindingRepository intentWorkflowBindingRepository;

  public DomainPackDraftPersistenceService(
      DomainPackVersionRepository domainPackVersionRepository,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      IntentWorkflowBindingRepository intentWorkflowBindingRepository) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.intentWorkflowBindingRepository = intentWorkflowBindingRepository;
  }

  /** DRAFT 버전만 생성한다 (intent/slot/policy 등은 저장하지 않음). Airflow 파이프라인 콜백의 1단계에서 사용한다. */
  public DomainPackVersion persistVersion(
      Long packId, Long createdBy, Long sourcePipelineJobId, String summaryJson) {
    int nextVersionNo =
        domainPackVersionRepository.findMaxVersionNoByDomainPackId(packId).orElse(0) + 1;

    DomainPackVersion draftVersion =
        DomainPackVersion.createDraft(
            packId, nextVersionNo, createdBy, sourcePipelineJobId, summaryJson);

    try {
      return domainPackVersionRepository.saveAndFlush(draftVersion);
    } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException ex) {
      throw new DomainPackVersionConflictException(packId, ex);
    }
  }

  /** 기존 DRAFT 버전에 intent를 추가 저장한다. 이미 존재하는 intentCode는 건너뛴다. Airflow 파이프라인 콜백의 2단계에서 사용한다. */
  public AddIntentsToDraftVersionResult persistIntents(
      Long domainPackVersionId, List<IntentDraft> intents) {
    DomainPackVersion version = requireDraftVersion(domainPackVersionId);
    List<IntentDraft> safeIntents = safeList(intents);
    ensureUnique(safeIntents, IntentDraft::intentCode, "intentCode");

    List<IntentDraft> newIntents =
        safeIntents.stream()
            .filter(
                intent ->
                    !intentDefinitionRepository.existsByDomainPackVersionIdAndIntentCode(
                        domainPackVersionId, intent.intentCode()))
            .toList();
    int skippedCount = safeIntents.size() - newIntents.size();

    List<IntentDefinition> savedIntents =
        intentDefinitionRepository.saveAllAndFlush(
            newIntents.stream()
                .map(
                    intent ->
                        IntentDefinition.create(
                            domainPackVersionId,
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
        indexByCode(savedIntents, IntentDefinition::getIntentCode);

    boolean hasParentIntent = false;
    for (IntentDraft draft : newIntents) {
      if (draft.parentIntentCode() == null || draft.parentIntentCode().isBlank()) {
        continue;
      }
      hasParentIntent = true;
      IntentDefinition child = requireByCode(intentsByCode, draft.intentCode(), "intent");
      IntentDefinition parent =
          resolveParentIntent(domainPackVersionId, intentsByCode, draft.parentIntentCode());
      if (parent == null) {
        throw new DomainPackDraftRequestInvalidException(
            "parentIntentCode를 찾을 수 없습니다. intentCode="
                + draft.intentCode()
                + ", parentIntentCode="
                + draft.parentIntentCode());
      }
      child.assignParent(parent.getId());
    }
    if (hasParentIntent) {
      intentDefinitionRepository.saveAllAndFlush(savedIntents);
    }

    long totalCount = intentDefinitionRepository.countByDomainPackVersionId(domainPackVersionId);
    return new AddIntentsToDraftVersionResult(
        domainPackVersionId,
        version.getDomainPackId(),
        savedIntents.size(),
        skippedCount,
        (int) totalCount);
  }

  /** UI에서 수동으로 전체 draft를 한 번에 저장할 때 사용한다. */
  public CreateDomainPackDraftResult persist(
      Long packId,
      Long createdBy,
      Long sourcePipelineJobId,
      String summaryJson,
      List<IntentDraft> intents,
      List<CreateDomainPackDraftCommand.SlotDraft> slots,
      List<CreateDomainPackDraftCommand.IntentSlotBindingDraft> intentSlotBindings,
      List<CreateDomainPackDraftCommand.PolicyDraft> policies,
      List<CreateDomainPackDraftCommand.RiskDraft> risks,
      List<CreateDomainPackDraftCommand.WorkflowDraft> workflows,
      List<CreateDomainPackDraftCommand.IntentWorkflowBindingDraft> intentWorkflowBindings) {
    List<CreateDomainPackDraftCommand.WorkflowDraft> validatedWorkflows =
        validateDraftPayload(
            intents, slots, intentSlotBindings, policies, risks, workflows, intentWorkflowBindings);

    int nextVersionNo =
        domainPackVersionRepository.findMaxVersionNoByDomainPackId(packId).orElse(0) + 1;

    DomainPackVersion draftVersion =
        DomainPackVersion.createDraft(
            packId, nextVersionNo, createdBy, sourcePipelineJobId, summaryJson);

    DomainPackVersion savedVersion;
    try {
      savedVersion = domainPackVersionRepository.saveAndFlush(draftVersion);
    } catch (DataIntegrityViolationException | ObjectOptimisticLockingFailureException ex) {
      throw new DomainPackVersionConflictException(packId, ex);
    }

    List<IntentDefinition> savedIntents =
        intentDefinitionRepository.saveAllAndFlush(
            safeList(intents).stream()
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
        indexByCode(savedIntents, IntentDefinition::getIntentCode);

    boolean hasParentIntent = false;
    for (IntentDraft draft : safeList(intents)) {
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
      child.assignParent(parent.getId());
    }
    if (hasParentIntent) {
      savedIntents = intentDefinitionRepository.saveAllAndFlush(savedIntents);
    }

    List<SlotDefinition> savedSlots =
        slotDefinitionRepository.saveAll(
            safeList(slots).stream()
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
    Map<String, SlotDefinition> slotsByCode = indexByCode(savedSlots, SlotDefinition::getSlotCode);

    List<PolicyDefinition> savedPolicies =
        policyDefinitionRepository.saveAll(
            safeList(policies).stream()
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

    List<RiskDefinition> savedRisks =
        riskDefinitionRepository.saveAll(
            safeList(risks).stream()
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

    List<WorkflowDefinition> savedWorkflows =
        workflowDefinitionRepository.saveAll(
            validatedWorkflows.stream()
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
        indexByCode(savedWorkflows, WorkflowDefinition::getWorkflowCode);

    intentSlotBindingRepository.saveAll(
        safeList(intentSlotBindings).stream()
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
        safeList(intentWorkflowBindings).stream()
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
        savedIntents.size(),
        savedSlots.size(),
        savedPolicies.size(),
        savedRisks.size(),
        savedWorkflows.size());
  }

  private List<CreateDomainPackDraftCommand.WorkflowDraft> validateDraftPayload(
      List<IntentDraft> intents,
      List<CreateDomainPackDraftCommand.SlotDraft> slots,
      List<CreateDomainPackDraftCommand.IntentSlotBindingDraft> intentSlotBindings,
      List<CreateDomainPackDraftCommand.PolicyDraft> policies,
      List<CreateDomainPackDraftCommand.RiskDraft> risks,
      List<CreateDomainPackDraftCommand.WorkflowDraft> workflows,
      List<CreateDomainPackDraftCommand.IntentWorkflowBindingDraft> intentWorkflowBindings) {
    ensureUnique(safeList(intents), IntentDraft::intentCode, "intentCode");
    ensureUnique(safeList(slots), CreateDomainPackDraftCommand.SlotDraft::slotCode, "slotCode");
    ensureUnique(
        safeList(policies), CreateDomainPackDraftCommand.PolicyDraft::policyCode, "policyCode");
    ensureUnique(safeList(risks), CreateDomainPackDraftCommand.RiskDraft::riskCode, "riskCode");
    ensureUnique(
        safeList(workflows),
        CreateDomainPackDraftCommand.WorkflowDraft::workflowCode,
        "workflowCode");
    ensureUnique(
        safeList(intentSlotBindings),
        binding -> binding.intentCode() + "::" + binding.slotCode(),
        "intentSlotBinding");
    ensureUnique(
        safeList(intentWorkflowBindings),
        binding -> binding.intentCode() + "::" + binding.workflowCode(),
        "intentWorkflowBinding");

    return safeList(workflows).stream().map(this::validateAndNormalizeWorkflow).toList();
  }

  private CreateDomainPackDraftCommand.WorkflowDraft validateAndNormalizeWorkflow(
      CreateDomainPackDraftCommand.WorkflowDraft workflow) {
    WorkflowGraphValidator.ParsedGraph graph =
        WorkflowGraphValidator.parseAndValidate(workflow.graphJson(), workflow.workflowCode());
    return new CreateDomainPackDraftCommand.WorkflowDraft(
        workflow.workflowCode(),
        workflow.name(),
        workflow.description(),
        workflow.graphJson(),
        WorkflowGraphValidator.extractInitialState(graph),
        WorkflowGraphValidator.extractTerminalStatesJson(graph),
        workflow.evidenceJson(),
        workflow.metaJson());
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

  private IntentDefinition resolveParentIntent(
      Long domainPackVersionId,
      Map<String, IntentDefinition> intentsByCode,
      String parentIntentCode) {
    IntentDefinition parent = intentsByCode.get(parentIntentCode);
    if (parent != null) {
      return parent;
    }
    return intentDefinitionRepository
        .findByDomainPackVersionIdAndIntentCode(domainPackVersionId, parentIntentCode)
        .orElse(null);
  }

  private DomainPackVersion requireDraftVersion(Long domainPackVersionId) {
    DomainPackVersion version =
        domainPackVersionRepository
            .findById(domainPackVersionId)
            .orElseThrow(() -> new DomainPackVersionNotFoundException(domainPackVersionId));
    if (!DomainPackVersion.STATUS_DRAFT.equals(version.getLifecycleStatus())) {
      throw new DomainPackVersionNotDraftException(domainPackVersionId);
    }
    return version;
  }
}
