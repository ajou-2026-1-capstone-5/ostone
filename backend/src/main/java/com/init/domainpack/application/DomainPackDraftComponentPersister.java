package com.init.domainpack.application;

import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.indexByCode;
import static com.init.domainpack.application.DomainPackDraftPersistenceSupport.requireByCode;

import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
class DomainPackDraftComponentPersister {

  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;

  DomainPackDraftComponentPersister(
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      IntentSlotBindingRepository intentSlotBindingRepository) {
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
  }

  SavedDraftComponents save(
      Long domainPackVersionId,
      Map<String, IntentDefinition> intentsByCode,
      DraftComponentsInput components) {
    List<SlotDefinition> savedSlots =
        slotDefinitionRepository.saveAll(
            components.slots().stream()
                .map(slot -> createSlot(domainPackVersionId, slot))
                .toList());
    Map<String, SlotDefinition> slotsByCode = indexByCode(savedSlots, SlotDefinition::getSlotCode);

    List<PolicyDefinition> savedPolicies =
        policyDefinitionRepository.saveAll(
            components.policies().stream()
                .map(policy -> createPolicy(domainPackVersionId, policy))
                .toList());

    List<RiskDefinition> savedRisks =
        riskDefinitionRepository.saveAll(
            components.risks().stream()
                .map(risk -> createRisk(domainPackVersionId, risk))
                .toList());

    List<WorkflowDefinition> savedWorkflows =
        workflowDefinitionRepository.saveAll(
            components.workflows().stream()
                .map(workflow -> createWorkflow(domainPackVersionId, intentsByCode, workflow))
                .toList());

    List<IntentSlotBinding> savedIntentSlotBindings =
        intentSlotBindingRepository.saveAll(
            components.intentSlotBindings().stream()
                .map(binding -> createIntentSlotBinding(intentsByCode, slotsByCode, binding))
                .toList());

    return new SavedDraftComponents(
        savedSlots.size(),
        savedPolicies.size(),
        savedRisks.size(),
        savedWorkflows.size(),
        savedIntentSlotBindings.size());
  }

  private SlotDefinition createSlot(Long domainPackVersionId, SlotInput slot) {
    return SlotDefinition.create(
        domainPackVersionId,
        slot.slotCode(),
        slot.name(),
        slot.description(),
        slot.dataType(),
        slot.isSensitive(),
        slot.validationRuleJson(),
        slot.defaultValueJson(),
        slot.metaJson());
  }

  private PolicyDefinition createPolicy(Long domainPackVersionId, PolicyInput policy) {
    return PolicyDefinition.create(
        domainPackVersionId,
        policy.policyCode(),
        policy.name(),
        policy.description(),
        policy.severity(),
        policy.conditionJson(),
        policy.actionJson(),
        policy.evidenceJson(),
        policy.metaJson());
  }

  private RiskDefinition createRisk(Long domainPackVersionId, RiskInput risk) {
    return RiskDefinition.create(
        domainPackVersionId,
        risk.riskCode(),
        risk.name(),
        risk.description(),
        risk.riskLevel(),
        risk.triggerConditionJson(),
        risk.handlingActionJson(),
        risk.evidenceJson(),
        risk.metaJson());
  }

  private WorkflowDefinition createWorkflow(
      Long domainPackVersionId,
      Map<String, IntentDefinition> intentsByCode,
      WorkflowInput workflow) {
    return WorkflowDefinition.create(
        domainPackVersionId,
        workflow.workflowCode(),
        workflow.name(),
        workflow.description(),
        workflow.graphJson(),
        workflow.initialState(),
        workflow.terminalStatesJson(),
        workflow.evidenceJson(),
        workflow.metaJson(),
        requireByCode(intentsByCode, workflow.intentCode(), "intent").getId(),
        workflow.isPrimary(),
        workflow.routeConditionJson());
  }

  private IntentSlotBinding createIntentSlotBinding(
      Map<String, IntentDefinition> intentsByCode,
      Map<String, SlotDefinition> slotsByCode,
      IntentSlotBindingInput binding) {
    return IntentSlotBinding.create(
        requireByCode(intentsByCode, binding.intentCode(), "intent").getId(),
        requireByCode(slotsByCode, binding.slotCode(), "slot").getId(),
        binding.isRequired(),
        binding.collectionOrder(),
        binding.promptHint(),
        binding.conditionJson());
  }
}
