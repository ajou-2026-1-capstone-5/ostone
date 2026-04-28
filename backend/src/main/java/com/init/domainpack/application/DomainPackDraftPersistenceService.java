package com.init.domainpack.application;

import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackVersionNotDraftException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefNotFoundException;
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
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
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
    DraftComponentsInput components =
        new DraftComponentsInput(
            toSlotInputs(slots),
            toPolicyInputs(policies),
            toRiskInputs(risks),
            toWorkflowInputs(workflows),
            toIntentSlotBindingInputs(intentSlotBindings),
            toIntentWorkflowBindingInputs(intentWorkflowBindings));
    List<WorkflowInput> validatedWorkflows =
        validateDraftPayload(
            intents,
            components.slots(),
            components.intentSlotBindings(),
            components.policies(),
            components.risks(),
            components.workflows(),
            components.intentWorkflowBindings(),
            Set.of());

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

    SavedDraftComponents savedComponents =
        saveDraftComponents(
            savedVersion.getId(),
            intentsByCode,
            new DraftComponentsInput(
                components.slots(),
                components.policies(),
                components.risks(),
                validatedWorkflows,
                components.intentSlotBindings(),
                components.intentWorkflowBindings()));

    return CreateDomainPackDraftResult.from(
        savedVersion,
        savedIntents.size(),
        savedComponents.addedSlotCount(),
        savedComponents.addedPolicyCount(),
        savedComponents.addedRiskCount(),
        savedComponents.addedWorkflowCount());
  }

  /** 기존 DRAFT 버전에 workflow 관련 초안을 추가 저장한다. intent는 새로 만들지 않고 기존 row를 참조한다. */
  public AddWorkflowDraftToVersionResult persistWorkflowDraft(
      Long domainPackVersionId,
      List<AddWorkflowDraftToVersionCommand.SlotDraft> slots,
      List<AddWorkflowDraftToVersionCommand.PolicyDraft> policies,
      List<AddWorkflowDraftToVersionCommand.RiskDraft> risks,
      List<AddWorkflowDraftToVersionCommand.WorkflowDraft> workflows,
      List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> intentSlotBindings,
      List<AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft> intentWorkflowBindings) {
    DomainPackVersion version = requireDraftVersion(domainPackVersionId);
    DraftComponentsInput components =
        new DraftComponentsInput(
            toSlotInputsFromWorkflowCallback(slots),
            toPolicyInputsFromWorkflowCallback(policies),
            toRiskInputsFromWorkflowCallback(risks),
            toWorkflowInputsFromWorkflowCallback(workflows),
            toIntentSlotBindingInputsFromWorkflowCallback(intentSlotBindings),
            toIntentWorkflowBindingInputsFromWorkflowCallback(intentWorkflowBindings));
    validateNonEmptyWorkflowDraft(components);

    Set<String> submittedPolicyCodes =
        components.policies().stream().map(PolicyInput::policyCode).collect(Collectors.toSet());
    Set<String> existingPolicyCodes =
        findExistingPolicyCodes(
            domainPackVersionId, collectWorkflowPolicyRefs(components.workflows()));
    Set<String> allowedPolicyCodes = submittedPolicyCodes.stream().collect(Collectors.toSet());
    allowedPolicyCodes.addAll(existingPolicyCodes);
    List<WorkflowInput> validatedWorkflows =
        validateDraftPayload(
            List.of(),
            components.slots(),
            components.intentSlotBindings(),
            components.policies(),
            components.risks(),
            components.workflows(),
            components.intentWorkflowBindings(),
            allowedPolicyCodes);

    Map<String, IntentDefinition> intentsByCode =
        indexByCode(
            intentDefinitionRepository.findByDomainPackVersionId(domainPackVersionId),
            IntentDefinition::getIntentCode);
    SavedDraftComponents savedComponents =
        saveDraftComponents(
            domainPackVersionId,
            intentsByCode,
            new DraftComponentsInput(
                components.slots(),
                components.policies(),
                components.risks(),
                validatedWorkflows,
                components.intentSlotBindings(),
                components.intentWorkflowBindings()));

    return new AddWorkflowDraftToVersionResult(
        domainPackVersionId,
        version.getDomainPackId(),
        savedComponents.addedSlotCount(),
        savedComponents.addedPolicyCount(),
        savedComponents.addedRiskCount(),
        savedComponents.addedWorkflowCount(),
        savedComponents.addedIntentSlotBindingCount(),
        savedComponents.addedIntentWorkflowBindingCount());
  }

  private SavedDraftComponents saveDraftComponents(
      Long domainPackVersionId,
      Map<String, IntentDefinition> intentsByCode,
      DraftComponentsInput components) {
    List<SlotDefinition> savedSlots =
        slotDefinitionRepository.saveAll(
            components.slots().stream()
                .map(
                    slot ->
                        SlotDefinition.create(
                            domainPackVersionId,
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
            components.policies().stream()
                .map(
                    policy ->
                        PolicyDefinition.create(
                            domainPackVersionId,
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
            components.risks().stream()
                .map(
                    risk ->
                        RiskDefinition.create(
                            domainPackVersionId,
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
            components.workflows().stream()
                .map(
                    workflow ->
                        WorkflowDefinition.create(
                            domainPackVersionId,
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

    List<IntentSlotBinding> savedIntentSlotBindings =
        intentSlotBindingRepository.saveAll(
            components.intentSlotBindings().stream()
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

    List<IntentWorkflowBinding> savedIntentWorkflowBindings =
        intentWorkflowBindingRepository.saveAll(
            components.intentWorkflowBindings().stream()
                .map(
                    binding ->
                        IntentWorkflowBinding.create(
                            requireByCode(intentsByCode, binding.intentCode(), "intent").getId(),
                            requireByCode(workflowsByCode, binding.workflowCode(), "workflow")
                                .getId(),
                            binding.isPrimary(),
                            binding.routeConditionJson()))
                .toList());

    return new SavedDraftComponents(
        savedSlots.size(),
        savedPolicies.size(),
        savedRisks.size(),
        savedWorkflows.size(),
        savedIntentSlotBindings.size(),
        savedIntentWorkflowBindings.size());
  }

  private List<WorkflowInput> validateDraftPayload(
      List<IntentDraft> intents,
      List<SlotInput> slots,
      List<IntentSlotBindingInput> intentSlotBindings,
      List<PolicyInput> policies,
      List<RiskInput> risks,
      List<WorkflowInput> workflows,
      List<IntentWorkflowBindingInput> intentWorkflowBindings,
      Set<String> allowedPolicyCodes) {
    ensureUnique(safeList(intents), IntentDraft::intentCode, "intentCode");
    ensureUnique(safeList(slots), SlotInput::slotCode, "slotCode");
    ensureUnique(safeList(policies), PolicyInput::policyCode, "policyCode");
    ensureUnique(safeList(risks), RiskInput::riskCode, "riskCode");
    ensureUnique(safeList(workflows), WorkflowInput::workflowCode, "workflowCode");
    ensureUnique(
        safeList(intentSlotBindings),
        binding -> binding.intentCode() + "::" + binding.slotCode(),
        "intentSlotBinding");
    ensureUnique(
        safeList(intentWorkflowBindings),
        binding -> binding.intentCode() + "::" + binding.workflowCode(),
        "intentWorkflowBinding");

    Set<String> submittedPolicyCodes =
        safeList(policies).stream().map(PolicyInput::policyCode).collect(Collectors.toSet());
    Set<String> policyCodes = submittedPolicyCodes.stream().collect(Collectors.toSet());
    policyCodes.addAll(allowedPolicyCodes);
    return safeList(workflows).stream()
        .map(w -> validateAndNormalizeWorkflow(w, policyCodes))
        .toList();
  }

  private WorkflowInput validateAndNormalizeWorkflow(
      WorkflowInput workflow, Set<String> allowedPolicyCodes) {
    WorkflowGraphValidator.ParsedGraph graph =
        WorkflowGraphValidator.parseAndValidate(workflow.graphJson(), workflow.workflowCode());
    graph.nodes().stream()
        .filter(n -> "ACTION".equals(n.type()))
        .map(WorkflowGraphValidator.GraphNode::policyRef)
        .filter(ref -> !allowedPolicyCodes.contains(ref))
        .findFirst()
        .ifPresent(
            ref -> {
              throw new WorkflowActionNodePolicyRefNotFoundException(ref);
            });
    return new WorkflowInput(
        workflow.workflowCode(),
        workflow.name(),
        workflow.description(),
        workflow.graphJson(),
        WorkflowGraphValidator.extractInitialState(graph),
        WorkflowGraphValidator.extractTerminalStatesJson(graph),
        workflow.evidenceJson(),
        workflow.metaJson());
  }

  private void validateNonEmptyWorkflowDraft(DraftComponentsInput components) {
    if (components.slots().isEmpty()
        && components.policies().isEmpty()
        && components.risks().isEmpty()
        && components.workflows().isEmpty()
        && components.intentSlotBindings().isEmpty()
        && components.intentWorkflowBindings().isEmpty()) {
      throw new DomainPackDraftRequestInvalidException("workflow draft payload는 비어 있을 수 없습니다.");
    }
  }

  private Set<String> collectWorkflowPolicyRefs(List<WorkflowInput> workflows) {
    return workflows.stream()
        .flatMap(
            workflow ->
                WorkflowGraphValidator.parseAndValidate(
                    workflow.graphJson(), workflow.workflowCode())
                    .nodes()
                    .stream())
        .filter(node -> "ACTION".equals(node.type()))
        .map(WorkflowGraphValidator.GraphNode::policyRef)
        .collect(Collectors.toSet());
  }

  private Set<String> findExistingPolicyCodes(Long domainPackVersionId, Set<String> policyCodes) {
    if (policyCodes.isEmpty()) {
      return Set.of();
    }
    return policyDefinitionRepository.findExistingPolicyCodesByVersionIdAndCodes(
        domainPackVersionId, policyCodes);
  }

  private List<SlotInput> toSlotInputs(List<CreateDomainPackDraftCommand.SlotDraft> slots) {
    return safeList(slots).stream()
        .map(
            slot ->
                new SlotInput(
                    slot.slotCode(),
                    slot.name(),
                    slot.description(),
                    slot.dataType(),
                    slot.isSensitive(),
                    slot.validationRuleJson(),
                    slot.defaultValueJson(),
                    slot.metaJson()))
        .toList();
  }

  private List<SlotInput> toSlotInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.SlotDraft> slots) {
    return safeList(slots).stream()
        .map(
            slot ->
                new SlotInput(
                    slot.slotCode(),
                    slot.name(),
                    slot.description(),
                    slot.dataType(),
                    slot.isSensitive(),
                    slot.validationRuleJson(),
                    slot.defaultValueJson(),
                    slot.metaJson()))
        .toList();
  }

  private List<PolicyInput> toPolicyInputs(
      List<CreateDomainPackDraftCommand.PolicyDraft> policies) {
    return safeList(policies).stream()
        .map(
            policy ->
                new PolicyInput(
                    policy.policyCode(),
                    policy.name(),
                    policy.description(),
                    policy.severity(),
                    policy.conditionJson(),
                    policy.actionJson(),
                    policy.evidenceJson(),
                    policy.metaJson()))
        .toList();
  }

  private List<PolicyInput> toPolicyInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.PolicyDraft> policies) {
    return safeList(policies).stream()
        .map(
            policy ->
                new PolicyInput(
                    policy.policyCode(),
                    policy.name(),
                    policy.description(),
                    policy.severity(),
                    policy.conditionJson(),
                    policy.actionJson(),
                    policy.evidenceJson(),
                    policy.metaJson()))
        .toList();
  }

  private List<RiskInput> toRiskInputs(List<CreateDomainPackDraftCommand.RiskDraft> risks) {
    return safeList(risks).stream()
        .map(
            risk ->
                new RiskInput(
                    risk.riskCode(),
                    risk.name(),
                    risk.description(),
                    risk.riskLevel(),
                    risk.triggerConditionJson(),
                    risk.handlingActionJson(),
                    risk.evidenceJson(),
                    risk.metaJson()))
        .toList();
  }

  private List<RiskInput> toRiskInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.RiskDraft> risks) {
    return safeList(risks).stream()
        .map(
            risk ->
                new RiskInput(
                    risk.riskCode(),
                    risk.name(),
                    risk.description(),
                    risk.riskLevel(),
                    risk.triggerConditionJson(),
                    risk.handlingActionJson(),
                    risk.evidenceJson(),
                    risk.metaJson()))
        .toList();
  }

  private List<WorkflowInput> toWorkflowInputs(
      List<CreateDomainPackDraftCommand.WorkflowDraft> workflows) {
    return safeList(workflows).stream()
        .map(
            workflow ->
                new WorkflowInput(
                    workflow.workflowCode(),
                    workflow.name(),
                    workflow.description(),
                    workflow.graphJson(),
                    workflow.initialState(),
                    workflow.terminalStatesJson(),
                    workflow.evidenceJson(),
                    workflow.metaJson()))
        .toList();
  }

  private List<WorkflowInput> toWorkflowInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.WorkflowDraft> workflows) {
    return safeList(workflows).stream()
        .map(
            workflow ->
                new WorkflowInput(
                    workflow.workflowCode(),
                    workflow.name(),
                    workflow.description(),
                    workflow.graphJson(),
                    null,
                    null,
                    workflow.evidenceJson(),
                    workflow.metaJson()))
        .toList();
  }

  private List<IntentSlotBindingInput> toIntentSlotBindingInputs(
      List<CreateDomainPackDraftCommand.IntentSlotBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentSlotBindingInput(
                    binding.intentCode(),
                    binding.slotCode(),
                    binding.isRequired(),
                    binding.collectionOrder(),
                    binding.promptHint(),
                    binding.conditionJson()))
        .toList();
  }

  private List<IntentSlotBindingInput> toIntentSlotBindingInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.IntentSlotBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentSlotBindingInput(
                    binding.intentCode(),
                    binding.slotCode(),
                    binding.isRequired(),
                    binding.collectionOrder(),
                    binding.promptHint(),
                    binding.conditionJson()))
        .toList();
  }

  private List<IntentWorkflowBindingInput> toIntentWorkflowBindingInputs(
      List<CreateDomainPackDraftCommand.IntentWorkflowBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentWorkflowBindingInput(
                    binding.intentCode(),
                    binding.workflowCode(),
                    binding.isPrimary(),
                    binding.routeConditionJson()))
        .toList();
  }

  private List<IntentWorkflowBindingInput> toIntentWorkflowBindingInputsFromWorkflowCallback(
      List<AddWorkflowDraftToVersionCommand.IntentWorkflowBindingDraft> bindings) {
    return safeList(bindings).stream()
        .map(
            binding ->
                new IntentWorkflowBindingInput(
                    binding.intentCode(),
                    binding.workflowCode(),
                    binding.isPrimary(),
                    binding.routeConditionJson()))
        .toList();
  }

  private record DraftComponentsInput(
      List<SlotInput> slots,
      List<PolicyInput> policies,
      List<RiskInput> risks,
      List<WorkflowInput> workflows,
      List<IntentSlotBindingInput> intentSlotBindings,
      List<IntentWorkflowBindingInput> intentWorkflowBindings) {}

  private record SlotInput(
      String slotCode,
      String name,
      String description,
      String dataType,
      Boolean isSensitive,
      String validationRuleJson,
      String defaultValueJson,
      String metaJson) {}

  private record PolicyInput(
      String policyCode,
      String name,
      String description,
      String severity,
      String conditionJson,
      String actionJson,
      String evidenceJson,
      String metaJson) {}

  private record RiskInput(
      String riskCode,
      String name,
      String description,
      String riskLevel,
      String triggerConditionJson,
      String handlingActionJson,
      String evidenceJson,
      String metaJson) {}

  private record WorkflowInput(
      String workflowCode,
      String name,
      String description,
      String graphJson,
      String initialState,
      String terminalStatesJson,
      String evidenceJson,
      String metaJson) {}

  private record IntentSlotBindingInput(
      String intentCode,
      String slotCode,
      Boolean isRequired,
      Integer collectionOrder,
      String promptHint,
      String conditionJson) {}

  private record IntentWorkflowBindingInput(
      String intentCode, String workflowCode, Boolean isPrimary, String routeConditionJson) {}

  private record SavedDraftComponents(
      int addedSlotCount,
      int addedPolicyCount,
      int addedRiskCount,
      int addedWorkflowCount,
      int addedIntentSlotBindingCount,
      int addedIntentWorkflowBindingCount) {}

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
