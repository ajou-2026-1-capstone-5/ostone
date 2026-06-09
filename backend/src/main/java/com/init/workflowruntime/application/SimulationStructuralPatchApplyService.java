package com.init.workflowruntime.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.init.domainpack.application.WorkflowGraphValidator;
import com.init.domainpack.application.WorkflowGraphValidator.WorkflowGraphValidation;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperation.ElementAttribute;
import com.init.workflowruntime.domain.StructuralPatchOperation.WorkflowNode;
import com.init.workflowruntime.domain.StructuralPatchOperation.WorkflowTransition;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 검증을 통과한 {@code simulation-structural-patch.v1} operation들을 draft Domain Pack 버전에만 적용한다. 한
 * operation이라도 실패하면 호출자의 트랜잭션이 롤백되어 부분 적용이 남지 않는다.
 */
@Service
public class SimulationStructuralPatchApplyService {

  private final IntentDefinitionRepository intentRepository;
  private final SlotDefinitionRepository slotRepository;
  private final PolicyDefinitionRepository policyRepository;
  private final RiskDefinitionRepository riskRepository;
  private final WorkflowDefinitionRepository workflowRepository;
  private final IntentSlotBindingRepository intentSlotBindingRepository;
  private final WorkflowGraphPatchApplier workflowGraphPatchApplier;
  private final ObjectMapper objectMapper;

  public SimulationStructuralPatchApplyService(
      IntentDefinitionRepository intentRepository,
      SlotDefinitionRepository slotRepository,
      PolicyDefinitionRepository policyRepository,
      RiskDefinitionRepository riskRepository,
      WorkflowDefinitionRepository workflowRepository,
      IntentSlotBindingRepository intentSlotBindingRepository,
      WorkflowGraphPatchApplier workflowGraphPatchApplier,
      ObjectMapper objectMapper) {
    this.intentRepository = intentRepository;
    this.slotRepository = slotRepository;
    this.policyRepository = policyRepository;
    this.riskRepository = riskRepository;
    this.workflowRepository = workflowRepository;
    this.intentSlotBindingRepository = intentSlotBindingRepository;
    this.workflowGraphPatchApplier = workflowGraphPatchApplier;
    this.objectMapper = objectMapper;
  }

  @Transactional
  public void apply(Long draftVersionId, StructuralDomainPackPatch patch) {
    List<StructuralPatchOperation> workflowOps = new ArrayList<>();
    for (StructuralPatchOperation operation : patch.operations()) {
      if (operation instanceof ElementAttribute elementOp) {
        applyElement(draftVersionId, elementOp);
      } else {
        workflowOps.add(operation);
      }
    }
    applyWorkflowOperations(draftVersionId, workflowOps);
  }

  private void applyElement(Long draftVersionId, ElementAttribute op) {
    switch (op.category()) {
      case INTENT -> applyIntent(draftVersionId, op);
      case SLOT -> applySlot(draftVersionId, op);
      case POLICY -> applyPolicy(draftVersionId, op);
      case RISK -> applyRisk(draftVersionId, op);
      case RESPONSE -> applyResponseCopy(draftVersionId, op);
      case WORKFLOW ->
          throw new InvalidStructuralPatchException(
              "workflow operation은 node/transition 형태여야 합니다.");
    }
  }

  private void applyIntent(Long draftVersionId, ElementAttribute op) {
    IntentDefinition intent = resolveIntent(draftVersionId, op);
    switch (op.type()) {
      case UPDATE_INTENT_DESCRIPTION ->
          intent.reviseDefinition(
              intent.getName(),
              op.value(),
              intent.getTaxonomyLevel(),
              intent.getEntryConditionJson(),
              intent.getMetaJson());
      case ADD_INTENT_EXAMPLE ->
          intent.reviseDefinition(
              intent.getName(),
              intent.getDescription(),
              intent.getTaxonomyLevel(),
              intent.getEntryConditionJson(),
              appendExample(intent.getMetaJson(), op.value()));
      default -> throw unsupported(op);
    }
    intentRepository.save(intent);
  }

  private void applySlot(Long draftVersionId, ElementAttribute op) {
    SlotDefinition slot = resolveSlot(draftVersionId, op);
    switch (op.type()) {
      case UPDATE_SLOT_DESCRIPTION ->
          slot.updateFields(
              slot.getName(),
              op.value(),
              slot.getIsSensitive(),
              slot.getValidationRuleJson(),
              slot.getDefaultValueJson(),
              slot.getMetaJson());
      case UPDATE_SLOT_VALIDATION ->
          slot.updateFields(
              slot.getName(),
              slot.getDescription(),
              slot.getIsSensitive(),
              mergeJsonObject(slot.getValidationRuleJson(), op.value()),
              slot.getDefaultValueJson(),
              slot.getMetaJson());
      case MARK_SLOT_REQUIRED -> {
        markSlotRequired(slot);
        return;
      }
      default -> throw unsupported(op);
    }
    slotRepository.save(slot);
  }

  private void applyPolicy(Long draftVersionId, ElementAttribute op) {
    if (op.type() != StructuralPatchOperationType.UPDATE_POLICY_CONDITION) {
      throw unsupported(op);
    }
    PolicyDefinition policy = resolvePolicy(draftVersionId, op);
    policy.updateFields(
        policy.getName(),
        policy.getDescription(),
        policy.getSeverity(),
        requireValidJson(op.value()),
        policy.getActionJson(),
        policy.getEvidenceJson(),
        policy.getMetaJson());
    policyRepository.save(policy);
  }

  private void applyRisk(Long draftVersionId, ElementAttribute op) {
    if (op.type() != StructuralPatchOperationType.UPDATE_RISK_TRIGGER) {
      throw unsupported(op);
    }
    RiskDefinition risk = resolveRisk(draftVersionId, op);
    risk.updateFields(
        risk.getName(),
        risk.getDescription(),
        risk.getRiskLevel(),
        requireValidJson(op.value()),
        risk.getHandlingActionJson(),
        risk.getEvidenceJson(),
        risk.getMetaJson());
    riskRepository.save(risk);
  }

  private void applyResponseCopy(Long draftVersionId, ElementAttribute op) {
    String responseCode = op.targetCode();
    if (responseCode == null) {
      throw new InvalidStructuralPatchException("UPDATE_RESPONSE_COPY는 responseCode가 필요합니다.");
    }
    List<WorkflowDefinition> workflows =
        workflowRepository.findAllByDomainPackVersionId(draftVersionId);
    WorkflowDefinition matchedWorkflow = null;
    String matchedGraph = null;
    for (WorkflowDefinition workflow : workflows) {
      Optional<String> patched =
          workflowGraphPatchApplier.applyResponseCopy(
              workflow.getGraphJson(), responseCode, op.value());
      if (patched.isPresent()) {
        if (matchedWorkflow != null) {
          throw new InvalidStructuralPatchException(
              "responseCode가 여러 workflow node와 일치하여 대상을 특정할 수 없습니다: " + responseCode);
        }
        matchedWorkflow = workflow;
        matchedGraph = patched.get();
      }
    }
    if (matchedWorkflow == null) {
      throw new InvalidStructuralPatchException("일치하는 response node를 찾을 수 없습니다: " + responseCode);
    }
    saveValidatedGraph(matchedWorkflow, matchedGraph);
  }

  private void applyWorkflowOperations(
      Long draftVersionId, List<StructuralPatchOperation> workflowOps) {
    Map<Long, WorkflowOperationGroup> groups = new LinkedHashMap<>();
    for (StructuralPatchOperation op : workflowOps) {
      WorkflowDefinition workflow = resolveWorkflow(draftVersionId, op);
      groups
          .computeIfAbsent(workflow.getId(), ignored -> new WorkflowOperationGroup(workflow))
          .operations()
          .add(op);
    }
    for (WorkflowOperationGroup group : groups.values()) {
      String newGraphJson =
          workflowGraphPatchApplier.apply(
              group.workflow().getGraphJson(),
              group.operations(),
              code -> slotExists(draftVersionId, code));
      saveValidatedGraph(group.workflow(), newGraphJson);
    }
  }

  private void saveValidatedGraph(WorkflowDefinition workflow, String newGraphJson) {
    WorkflowGraphValidation validation =
        WorkflowGraphValidator.validate(newGraphJson, workflow.getWorkflowCode());
    workflow.updateGraph(
        workflow.getName(),
        workflow.getDescription(),
        newGraphJson,
        validation.initialState(),
        validation.terminalStatesJson());
    workflowRepository.save(workflow);
  }

  private void markSlotRequired(SlotDefinition slot) {
    List<IntentSlotBinding> bindings =
        intentSlotBindingRepository.findAllBySlotDefinitionId(slot.getId());
    if (bindings.isEmpty()) {
      throw new InvalidStructuralPatchException(
          "필수로 표시할 slot의 intent binding이 없습니다: " + slot.getSlotCode());
    }
    bindings.forEach(IntentSlotBinding::markRequired);
    intentSlotBindingRepository.saveAll(bindings);
  }

  private boolean slotExists(Long draftVersionId, String slotCode) {
    return slotRepository
        .findByDomainPackVersionIdAndSlotCode(draftVersionId, slotCode)
        .isPresent();
  }

  private IntentDefinition resolveIntent(Long draftVersionId, ElementAttribute op) {
    if (op.targetCode() != null) {
      return intentRepository
          .findByDomainPackVersionIdAndIntentCode(draftVersionId, op.targetCode())
          .orElseThrow(() -> targetNotFound(op));
    }
    return intentRepository
        .findByIdAndDomainPackVersionId(op.targetId(), draftVersionId)
        .orElseThrow(() -> targetNotFound(op));
  }

  private SlotDefinition resolveSlot(Long draftVersionId, ElementAttribute op) {
    if (op.targetCode() != null) {
      return slotRepository
          .findByDomainPackVersionIdAndSlotCode(draftVersionId, op.targetCode())
          .orElseThrow(() -> targetNotFound(op));
    }
    return slotRepository
        .findByIdAndDomainPackVersionId(op.targetId(), draftVersionId)
        .orElseThrow(() -> targetNotFound(op));
  }

  private PolicyDefinition resolvePolicy(Long draftVersionId, ElementAttribute op) {
    if (op.targetCode() != null) {
      return policyRepository
          .findByDomainPackVersionIdAndPolicyCode(draftVersionId, op.targetCode())
          .orElseThrow(() -> targetNotFound(op));
    }
    return policyRepository
        .findByIdAndDomainPackVersionId(op.targetId(), draftVersionId)
        .orElseThrow(() -> targetNotFound(op));
  }

  private RiskDefinition resolveRisk(Long draftVersionId, ElementAttribute op) {
    if (op.targetCode() != null) {
      return riskRepository
          .findByDomainPackVersionIdAndRiskCode(draftVersionId, op.targetCode())
          .orElseThrow(() -> targetNotFound(op));
    }
    return riskRepository
        .findByIdAndDomainPackVersionId(op.targetId(), draftVersionId)
        .orElseThrow(() -> targetNotFound(op));
  }

  private WorkflowDefinition resolveWorkflow(Long draftVersionId, StructuralPatchOperation op) {
    String workflowCode;
    Long workflowDefinitionId;
    switch (op) {
      case WorkflowNode node -> {
        workflowCode = node.workflowCode();
        workflowDefinitionId = node.workflowDefinitionId();
      }
      case WorkflowTransition transition -> {
        workflowCode = transition.workflowCode();
        workflowDefinitionId = transition.workflowDefinitionId();
      }
      default ->
          throw new InvalidStructuralPatchException("workflow operation이 아닙니다: " + op.type());
    }
    if (workflowCode != null) {
      return workflowRepository
          .findByDomainPackVersionIdAndWorkflowCode(draftVersionId, workflowCode)
          .orElseThrow(
              () -> new InvalidStructuralPatchException("대상 workflow를 찾을 수 없습니다: " + workflowCode));
    }
    return workflowRepository
        .findByIdAndDomainPackVersionId(workflowDefinitionId, draftVersionId)
        .orElseThrow(
            () ->
                new InvalidStructuralPatchException(
                    "대상 workflow를 찾을 수 없습니다: " + workflowDefinitionId));
  }

  private String appendExample(String metaJson, String example) {
    ObjectNode meta = readObjectOrEmpty(metaJson);
    JsonNode examplesNode = meta.get("examples");
    ArrayNode examples =
        examplesNode != null && examplesNode.isArray()
            ? (ArrayNode) examplesNode
            : meta.putArray("examples");
    examples.add(example);
    return write(meta);
  }

  private String mergeJsonObject(String existingJson, String patchJson) {
    ObjectNode existing = readObjectOrEmpty(existingJson);
    JsonNode patch = readTree(patchJson);
    if (!patch.isObject()) {
      throw new InvalidStructuralPatchException("validation 값은 JSON object여야 합니다.");
    }
    existing.setAll((ObjectNode) patch);
    return write(existing);
  }

  private String requireValidJson(String value) {
    readTree(value);
    return value;
  }

  private JsonNode readTree(String json) {
    try {
      return objectMapper.readTree(json);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("값이 유효한 JSON이 아닙니다.");
    }
  }

  private ObjectNode readObjectOrEmpty(String json) {
    if (json == null || json.isBlank()) {
      return objectMapper.createObjectNode();
    }
    JsonNode node = readTree(json);
    return node.isObject() ? (ObjectNode) node : objectMapper.createObjectNode();
  }

  private String write(JsonNode node) {
    try {
      return objectMapper.writeValueAsString(node);
    } catch (JsonProcessingException e) {
      throw new InvalidStructuralPatchException("JSON 직렬화에 실패했습니다.");
    }
  }

  private InvalidStructuralPatchException targetNotFound(ElementAttribute op) {
    String target = op.targetCode() != null ? op.targetCode() : String.valueOf(op.targetId());
    return new InvalidStructuralPatchException(op.type() + " 대상을 draft 버전에서 찾을 수 없습니다: " + target);
  }

  private InvalidStructuralPatchException unsupported(ElementAttribute op) {
    return new InvalidStructuralPatchException(
        op.category() + " 카테고리에서 지원하지 않는 operation입니다: " + op.type());
  }

  private record WorkflowOperationGroup(
      WorkflowDefinition workflow, List<StructuralPatchOperation> operations) {
    WorkflowOperationGroup(WorkflowDefinition workflow) {
      this(workflow, new ArrayList<>());
    }
  }
}
