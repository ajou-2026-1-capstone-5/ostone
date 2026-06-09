package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.DomainPackDraftSourceType;
import com.init.domainpack.application.DomainPackVersionCloneCommand;
import com.init.domainpack.application.DomainPackVersionCloneResult;
import com.init.domainpack.application.DomainPackVersionCloneService;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class SimulationImprovementDraftPatchService {

  private final DomainPackVersionRepository domainPackVersionRepository;
  private final DomainPackVersionCloneService domainPackVersionCloneService;
  private final IntentDefinitionRepository intentDefinitionRepository;
  private final SlotDefinitionRepository slotDefinitionRepository;
  private final PolicyDefinitionRepository policyDefinitionRepository;
  private final RiskDefinitionRepository riskDefinitionRepository;
  private final WorkflowDefinitionRepository workflowDefinitionRepository;
  private final StructuralDomainPackPatchParser structuralPatchParser;
  private final SimulationStructuralPatchApplyService structuralPatchApplyService;
  private final ObjectMapper objectMapper;

  public SimulationImprovementDraftPatchService(
      DomainPackVersionRepository domainPackVersionRepository,
      DomainPackVersionCloneService domainPackVersionCloneService,
      IntentDefinitionRepository intentDefinitionRepository,
      SlotDefinitionRepository slotDefinitionRepository,
      PolicyDefinitionRepository policyDefinitionRepository,
      RiskDefinitionRepository riskDefinitionRepository,
      WorkflowDefinitionRepository workflowDefinitionRepository,
      StructuralDomainPackPatchParser structuralPatchParser,
      SimulationStructuralPatchApplyService structuralPatchApplyService,
      ObjectMapper objectMapper) {
    this.domainPackVersionRepository = domainPackVersionRepository;
    this.domainPackVersionCloneService = domainPackVersionCloneService;
    this.intentDefinitionRepository = intentDefinitionRepository;
    this.slotDefinitionRepository = slotDefinitionRepository;
    this.policyDefinitionRepository = policyDefinitionRepository;
    this.riskDefinitionRepository = riskDefinitionRepository;
    this.workflowDefinitionRepository = workflowDefinitionRepository;
    this.structuralPatchParser = structuralPatchParser;
    this.structuralPatchApplyService = structuralPatchApplyService;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public DomainPackVersion applyDraftPatch(
      Long workspaceId, Long userId, SimulationImprovementCandidate candidate) {
    DomainPackVersion sourceVersion =
        domainPackVersionRepository
            .findByIdForUpdate(candidate.getDomainPackVersionId())
            .orElseThrow(
                () ->
                    new NotFoundException(
                        "DOMAIN_PACK_VERSION_NOT_FOUND",
                        "Domain pack version not found: " + candidate.getDomainPackVersionId()));
    DomainPackVersion draftVersion =
        resolveDraftVersion(workspaceId, userId, sourceVersion, candidate);
    if (isStructuralPatch(candidate.getDraftPatchJson())) {
      StructuralDomainPackPatch patch = structuralPatchParser.parse(candidate.getDraftPatchJson());
      structuralPatchApplyService.apply(draftVersion.getId(), patch);
    } else {
      applyDescriptionPatch(candidate, draftVersion.getId());
    }
    return draftVersion;
  }

  private boolean isStructuralPatch(String draftPatchJson) {
    if (draftPatchJson == null || draftPatchJson.isBlank()) {
      return false;
    }
    try {
      JsonNode root = objectMapper.readTree(draftPatchJson);
      return root.isObject()
          && StructuralDomainPackPatch.SCHEMA_VERSION.equals(
              root.path("schemaVersion").asText(null));
    } catch (JsonProcessingException e) {
      return false;
    }
  }

  private DomainPackVersion resolveDraftVersion(
      Long workspaceId,
      Long userId,
      DomainPackVersion sourceVersion,
      SimulationImprovementCandidate candidate) {
    if (DomainPackVersion.STATUS_DRAFT.equals(sourceVersion.getLifecycleStatus())) {
      return sourceVersion;
    }
    DomainPackVersion draft =
        domainPackVersionRepository
            .findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(
                sourceVersion.getDomainPackId(), DomainPackVersion.STATUS_DRAFT)
            .orElseGet(
                () -> {
                  DomainPackVersionCloneResult result =
                      domainPackVersionCloneService.cloneVersion(
                          new DomainPackVersionCloneCommand(
                              workspaceId,
                              sourceVersion.getDomainPackId(),
                              sourceVersion,
                              userId,
                              DomainPackDraftSourceType.SIMULATION_REVIEW,
                              "simulation improvement candidate #" + candidate.getId()));
                  return domainPackVersionRepository
                      .findByIdForUpdate(result.draftVersionId())
                      .orElseThrow(
                          () ->
                              new NotFoundException(
                                  "DOMAIN_PACK_VERSION_NOT_FOUND",
                                  "Domain pack version not found: " + result.draftVersionId()));
                });
    if (!DomainPackVersion.STATUS_DRAFT.equals(draft.getLifecycleStatus())) {
      throw new BadRequestException("DOMAIN_PACK_VERSION_NOT_DRAFT", "DRAFT version에만 반영할 수 있습니다.");
    }
    return domainPackVersionRepository
        .findByIdForUpdate(draft.getId())
        .orElseThrow(
            () ->
                new NotFoundException(
                    "DOMAIN_PACK_VERSION_NOT_FOUND",
                    "Domain pack version not found: " + draft.getId()));
  }

  private void applyDescriptionPatch(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    switch (candidate.getTargetElementType()) {
      case INTENT -> applyIntentPatch(candidate, draftVersionId);
      case SLOT -> applySlotPatch(candidate, draftVersionId);
      case POLICY -> applyPolicyPatch(candidate, draftVersionId);
      case RISK_RULE -> applyRiskPatch(candidate, draftVersionId);
      case WORKFLOW, HANDOFF, RESPONSE -> applyWorkflowPatch(candidate, draftVersionId);
      case UNKNOWN -> throw unsupportedTarget(candidate);
    }
  }

  private void applyIntentPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    IntentDefinition intent =
        resolveIntent(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    intent.reviseDefinition(
        intent.getName(),
        candidate.getAfterSummary(),
        intent.getTaxonomyLevel(),
        intent.getEntryConditionJson(),
        intent.getMetaJson());
    intentDefinitionRepository.save(intent);
  }

  private void applySlotPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    SlotDefinition slot =
        resolveSlot(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    slot.updateFields(
        slot.getName(),
        candidate.getAfterSummary(),
        slot.getIsSensitive(),
        slot.getValidationRuleJson(),
        slot.getDefaultValueJson(),
        slot.getMetaJson());
    slotDefinitionRepository.save(slot);
  }

  private void applyPolicyPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    PolicyDefinition policy =
        resolvePolicy(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    policy.updateFields(
        policy.getName(),
        candidate.getAfterSummary(),
        policy.getSeverity(),
        policy.getConditionJson(),
        policy.getActionJson(),
        policy.getEvidenceJson(),
        policy.getMetaJson());
    policyDefinitionRepository.save(policy);
  }

  private void applyRiskPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    RiskDefinition risk =
        resolveRisk(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    risk.updateFields(
        risk.getName(),
        candidate.getAfterSummary(),
        risk.getRiskLevel(),
        risk.getTriggerConditionJson(),
        risk.getHandlingActionJson(),
        risk.getEvidenceJson(),
        risk.getMetaJson());
    riskDefinitionRepository.save(risk);
  }

  private void applyWorkflowPatch(SimulationImprovementCandidate candidate, Long draftVersionId) {
    WorkflowDefinition workflow =
        resolveWorkflow(candidate, draftVersionId).orElseThrow(() -> targetNotFound(candidate));
    workflow.updateGraph(
        workflow.getName(),
        candidate.getAfterSummary(),
        workflow.getGraphJson(),
        workflow.getInitialState(),
        workflow.getTerminalStatesJson());
    workflowDefinitionRepository.save(workflow);
  }

  private Optional<IntentDefinition> resolveIntent(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          intentDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(IntentDefinition::getIntentCode)
              .orElse(null);
    }
    if (key != null) {
      return intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : intentDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<SlotDefinition> resolveSlot(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          slotDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(SlotDefinition::getSlotCode)
              .orElse(null);
    }
    if (key != null) {
      return slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : slotDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<PolicyDefinition> resolvePolicy(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          policyDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(PolicyDefinition::getPolicyCode)
              .orElse(null);
    }
    if (key != null) {
      return policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : policyDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<RiskDefinition> resolveRisk(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          riskDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(RiskDefinition::getRiskCode)
              .orElse(null);
    }
    if (key != null) {
      return riskDefinitionRepository.findByDomainPackVersionIdAndRiskCode(draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : riskDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private Optional<WorkflowDefinition> resolveWorkflow(
      SimulationImprovementCandidate candidate, Long draftVersionId) {
    String key = candidate.getTargetElementKey();
    if (key == null && candidate.getTargetElementId() != null) {
      key =
          workflowDefinitionRepository
              .findByIdAndDomainPackVersionId(
                  candidate.getTargetElementId(), candidate.getDomainPackVersionId())
              .map(WorkflowDefinition::getWorkflowCode)
              .orElse(null);
    }
    if (key != null) {
      return workflowDefinitionRepository.findByDomainPackVersionIdAndWorkflowCode(
          draftVersionId, key);
    }
    return candidate.getTargetElementId() == null
        ? Optional.empty()
        : workflowDefinitionRepository.findByIdAndDomainPackVersionId(
            candidate.getTargetElementId(), draftVersionId);
  }

  private BadRequestException targetNotFound(SimulationImprovementCandidate candidate) {
    return new BadRequestException(
        "SIMULATION_CANDIDATE_TARGET_NOT_FOUND",
        "개선 후보를 반영할 draft 대상 요소를 찾을 수 없습니다: " + candidate.getId());
  }

  private BadRequestException unsupportedTarget(SimulationImprovementCandidate candidate) {
    return new BadRequestException(
        "SIMULATION_CANDIDATE_TARGET_UNSUPPORTED",
        "변경 대상 요소를 명시해야 승인할 수 있습니다: " + candidate.getId());
  }
}
