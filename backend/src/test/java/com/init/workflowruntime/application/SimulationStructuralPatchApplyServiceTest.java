package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.slotDefinitionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import com.init.shared.application.exception.BadRequestException;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchEvidence;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationStructuralPatchApplyService")
class SimulationStructuralPatchApplyServiceTest {

  private static final Long DRAFT_VERSION_ID = 10L;
  private static final String BASE_GRAPH =
      "{\"nodes\":[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":[{\"id\":\"e1\",\"from\":\"start\",\"to\":\"end\"}]}";

  @Mock private IntentDefinitionRepository intentRepository;
  @Mock private SlotDefinitionRepository slotRepository;
  @Mock private PolicyDefinitionRepository policyRepository;
  @Mock private RiskDefinitionRepository riskRepository;
  @Mock private WorkflowDefinitionRepository workflowRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private SimulationStructuralPatchApplyService service;

  @BeforeEach
  void setUp() {
    service =
        new SimulationStructuralPatchApplyService(
            intentRepository,
            slotRepository,
            policyRepository,
            riskRepository,
            workflowRepository,
            intentSlotBindingRepository,
            new WorkflowGraphPatchApplier(objectMapper),
            objectMapper);
  }

  @Test
  @DisplayName("UPDATE_INTENT_DESCRIPTION은 description을 교체하고 저장한다")
  void should_updateIntentDescription() {
    IntentDefinition intent = intent("{}", "기존 설명");
    given(intentRepository.findByDomainPackVersionIdAndIntentCode(DRAFT_VERSION_ID, "greet"))
        .willReturn(Optional.of(intent));

    service.apply(
        DRAFT_VERSION_ID,
        patch(element(StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION, "greet", "새 설명")));

    assertThat(intent.getDescription()).isEqualTo("새 설명");
    verify(intentRepository).save(intent);
  }

  @Test
  @DisplayName("ADD_INTENT_EXAMPLE은 metaJson examples 배열에 추가하고 기존 데이터를 보존한다")
  void should_addIntentExample() throws Exception {
    IntentDefinition intent = intent("{\"note\":\"keep\"}", "설명");
    given(intentRepository.findByDomainPackVersionIdAndIntentCode(DRAFT_VERSION_ID, "greet"))
        .willReturn(Optional.of(intent));

    service.apply(
        DRAFT_VERSION_ID,
        patch(element(StructuralPatchOperationType.ADD_INTENT_EXAMPLE, "greet", "환불해 주세요")));

    JsonNode meta = objectMapper.readTree(intent.getMetaJson());
    assertThat(meta.path("note").asText()).isEqualTo("keep");
    assertThat(meta.path("examples").get(0).asText()).isEqualTo("환불해 주세요");
  }

  @Test
  @DisplayName("UPDATE_SLOT_VALIDATION은 기존 validation을 보존하며 merge한다")
  void should_mergeSlotValidation() throws Exception {
    SlotDefinition slot = slot("{\"maxLength\":10}");
    given(slotRepository.findByDomainPackVersionIdAndSlotCode(DRAFT_VERSION_ID, "pickup"))
        .willReturn(Optional.of(slot));

    service.apply(
        DRAFT_VERSION_ID,
        patch(
            element(
                StructuralPatchOperationType.UPDATE_SLOT_VALIDATION,
                "pickup",
                "{\"required\":true}")));

    JsonNode validation = objectMapper.readTree(slot.getValidationRuleJson());
    assertThat(validation.path("maxLength").asInt()).isEqualTo(10);
    assertThat(validation.path("required").asBoolean()).isTrue();
    verify(slotRepository).save(slot);
  }

  @Test
  @DisplayName("MARK_SLOT_REQUIRED은 slot의 모든 intent binding을 필수로 표시한다")
  void should_markSlotRequired() {
    SlotDefinition slot = slotDefinitionWithId(slot("{}"), 55L);
    given(slotRepository.findByDomainPackVersionIdAndSlotCode(DRAFT_VERSION_ID, "pickup"))
        .willReturn(Optional.of(slot));
    IntentSlotBinding binding = IntentSlotBinding.create(7L, 55L, false, 1, null, "{}");
    given(intentSlotBindingRepository.findAllBySlotDefinitionId(55L)).willReturn(List.of(binding));

    service.apply(
        DRAFT_VERSION_ID,
        patch(element(StructuralPatchOperationType.MARK_SLOT_REQUIRED, "pickup", null)));

    assertThat(binding.getIsRequired()).isTrue();
    verify(intentSlotBindingRepository).saveAll(List.of(binding));
  }

  @Test
  @DisplayName("MARK_SLOT_REQUIRED은 binding이 없으면 거절한다")
  void should_rejectMarkSlotRequiredWithoutBinding() {
    SlotDefinition slot = slotDefinitionWithId(slot("{}"), 55L);
    given(slotRepository.findByDomainPackVersionIdAndSlotCode(DRAFT_VERSION_ID, "pickup"))
        .willReturn(Optional.of(slot));
    given(intentSlotBindingRepository.findAllBySlotDefinitionId(55L)).willReturn(List.of());

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        element(StructuralPatchOperationType.MARK_SLOT_REQUIRED, "pickup", null))))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("binding");
  }

  @Test
  @DisplayName("UPDATE_POLICY_CONDITION은 잘못된 JSON을 거절한다")
  void should_rejectInvalidPolicyConditionJson() {
    PolicyDefinition policy = policy();
    given(policyRepository.findByDomainPackVersionIdAndPolicyCode(DRAFT_VERSION_ID, "p1"))
        .willReturn(Optional.of(policy));

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        element(
                            StructuralPatchOperationType.UPDATE_POLICY_CONDITION,
                            "p1",
                            "not-json"))))
        .isInstanceOf(InvalidStructuralPatchException.class);
    verify(policyRepository, never()).save(any());
  }

  @Test
  @DisplayName("UPDATE_RISK_TRIGGER은 condition JSON을 교체한다")
  void should_updateRiskTrigger() {
    RiskDefinition risk = risk();
    given(riskRepository.findByDomainPackVersionIdAndRiskCode(DRAFT_VERSION_ID, "r1"))
        .willReturn(Optional.of(risk));

    service.apply(
        DRAFT_VERSION_ID,
        patch(
            element(
                StructuralPatchOperationType.UPDATE_RISK_TRIGGER,
                "r1",
                "{\"type\":\"keyword\",\"value\":\"환불\"}")));

    assertThat(risk.getTriggerConditionJson()).contains("keyword");
    verify(riskRepository).save(risk);
  }

  @Test
  @DisplayName("대상 요소가 draft 버전에 없으면 거절한다")
  void should_rejectMissingTarget() {
    given(intentRepository.findByDomainPackVersionIdAndIntentCode(DRAFT_VERSION_ID, "ghost"))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        element(
                            StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION, "ghost", "x"))))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("찾을 수 없습니다");
  }

  @Test
  @DisplayName("workflow node와 transition을 추가하면 검증을 거쳐 graph가 저장된다")
  void should_applyWorkflowNodeAndTransition() throws Exception {
    WorkflowDefinition workflow = workflow(BASE_GRAPH);
    given(workflowRepository.findByDomainPackVersionIdAndWorkflowCode(DRAFT_VERSION_ID, "wf"))
        .willReturn(Optional.of(workflow));

    service.apply(
        DRAFT_VERSION_ID,
        patch(
            new StructuralPatchOperation.WorkflowNode(
                StructuralPatchOperationType.ADD_WORKFLOW_NODE,
                "wf",
                null,
                "answer_pickup",
                "ANSWER",
                null,
                "픽업 일자를 알려주세요",
                "reason"),
            new StructuralPatchOperation.WorkflowTransition(
                StructuralPatchOperationType.ADD_TRANSITION,
                "wf",
                null,
                "start",
                "answer_pickup",
                null,
                "reason")));

    JsonNode graph = objectMapper.readTree(workflow.getGraphJson());
    assertThat(nodeExists(graph, "answer_pickup")).isTrue();
    assertThat(workflow.getInitialState()).isEqualTo("start");
    assertThat(workflow.getTerminalStatesJson()).contains("end");
    verify(workflowRepository).save(workflow);
  }

  @Test
  @DisplayName("dangling transition을 만드는 패치는 검증에서 거절되고 graph를 저장하지 않는다")
  void should_rejectDanglingTransition_and_notSave() {
    WorkflowDefinition workflow = workflow(BASE_GRAPH);
    given(workflowRepository.findByDomainPackVersionIdAndWorkflowCode(DRAFT_VERSION_ID, "wf"))
        .willReturn(Optional.of(workflow));

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        new StructuralPatchOperation.WorkflowTransition(
                            StructuralPatchOperationType.ADD_TRANSITION,
                            "wf",
                            null,
                            "ghost",
                            "end",
                            null,
                            "reason"))))
        .isInstanceOf(BadRequestException.class);
    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("UPDATE_RESPONSE_COPY는 일치하는 단일 node의 copy를 설정한다")
  void should_applyResponseCopyToUniqueNode() throws Exception {
    WorkflowDefinition workflow = workflow(BASE_GRAPH);
    given(workflowRepository.findAllByDomainPackVersionId(DRAFT_VERSION_ID))
        .willReturn(List.of(workflow));

    service.apply(
        DRAFT_VERSION_ID,
        patch(element(StructuralPatchOperationType.UPDATE_RESPONSE_COPY, "end", "감사합니다")));

    JsonNode graph = objectMapper.readTree(workflow.getGraphJson());
    assertThat(nodeCopy(graph, "end")).isEqualTo("감사합니다");
    verify(workflowRepository).save(workflow);
  }

  @Test
  @DisplayName("UPDATE_RESPONSE_COPY는 여러 workflow node와 일치하면 거절한다")
  void should_rejectAmbiguousResponseCopy() {
    given(workflowRepository.findAllByDomainPackVersionId(DRAFT_VERSION_ID))
        .willReturn(List.of(workflow(BASE_GRAPH), workflow(BASE_GRAPH)));

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(element(StructuralPatchOperationType.UPDATE_RESPONSE_COPY, "end", "감사"))))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("여러 workflow");
  }

  @Test
  @DisplayName("UPDATE_RESPONSE_COPY는 일치하는 node가 없으면 거절한다")
  void should_rejectResponseCopyWithoutMatch() {
    given(workflowRepository.findAllByDomainPackVersionId(DRAFT_VERSION_ID))
        .willReturn(List.of(workflow(BASE_GRAPH)));

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        element(StructuralPatchOperationType.UPDATE_RESPONSE_COPY, "ghost", "감사"))))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("찾을 수 없습니다");
  }

  @Test
  @DisplayName("UPDATE_SLOT_VALIDATION은 JSON object가 아닌 값을 거절한다")
  void should_rejectNonObjectSlotValidation() {
    SlotDefinition slot = slot("{}");
    given(slotRepository.findByDomainPackVersionIdAndSlotCode(DRAFT_VERSION_ID, "pickup"))
        .willReturn(Optional.of(slot));

    assertThatThrownBy(
            () ->
                service.apply(
                    DRAFT_VERSION_ID,
                    patch(
                        element(
                            StructuralPatchOperationType.UPDATE_SLOT_VALIDATION, "pickup", "[]"))))
        .isInstanceOf(InvalidStructuralPatchException.class);
    verify(slotRepository, never()).save(any());
  }

  @Test
  @DisplayName("ADD_INTENT_EXAMPLE은 기존 examples 배열 뒤에 덧붙인다")
  void should_appendExampleToExistingArray() throws Exception {
    IntentDefinition intent = intent("{\"examples\":[\"기존\"]}", "설명");
    given(intentRepository.findByDomainPackVersionIdAndIntentCode(DRAFT_VERSION_ID, "greet"))
        .willReturn(Optional.of(intent));

    service.apply(
        DRAFT_VERSION_ID,
        patch(element(StructuralPatchOperationType.ADD_INTENT_EXAMPLE, "greet", "새 예시")));

    JsonNode examples = objectMapper.readTree(intent.getMetaJson()).path("examples");
    assertThat(examples).hasSize(2);
    assertThat(examples.get(0).asText()).isEqualTo("기존");
    assertThat(examples.get(1).asText()).isEqualTo("새 예시");
  }

  @Test
  @DisplayName("element operation은 targetCode 없이 targetId로 대상을 resolve한다")
  void should_resolveElementByTargetId() {
    IntentDefinition intent = intent("{}", "기존");
    given(intentRepository.findByIdAndDomainPackVersionId(7L, DRAFT_VERSION_ID))
        .willReturn(Optional.of(intent));
    SlotDefinition slot = slot("{}");
    given(slotRepository.findByIdAndDomainPackVersionId(8L, DRAFT_VERSION_ID))
        .willReturn(Optional.of(slot));
    PolicyDefinition policy = policy();
    given(policyRepository.findByIdAndDomainPackVersionId(9L, DRAFT_VERSION_ID))
        .willReturn(Optional.of(policy));
    RiskDefinition risk = risk();
    given(riskRepository.findByIdAndDomainPackVersionId(11L, DRAFT_VERSION_ID))
        .willReturn(Optional.of(risk));

    service.apply(
        DRAFT_VERSION_ID,
        patch(
            elementById(StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION, 7L, "새 설명"),
            elementById(StructuralPatchOperationType.UPDATE_SLOT_DESCRIPTION, 8L, "슬롯 설명"),
            elementById(StructuralPatchOperationType.UPDATE_POLICY_CONDITION, 9L, "{\"k\":1}"),
            elementById(StructuralPatchOperationType.UPDATE_RISK_TRIGGER, 11L, "{\"k\":2}")));

    assertThat(intent.getDescription()).isEqualTo("새 설명");
    assertThat(slot.getDescription()).isEqualTo("슬롯 설명");
    assertThat(policy.getConditionJson()).contains("\"k\"");
    assertThat(risk.getTriggerConditionJson()).contains("\"k\"");
  }

  @Test
  @DisplayName("workflow operation은 workflowDefinitionId로 대상을 resolve한다")
  void should_resolveWorkflowByDefinitionId() throws Exception {
    WorkflowDefinition workflow = workflow(BASE_GRAPH);
    given(workflowRepository.findByIdAndDomainPackVersionId(12L, DRAFT_VERSION_ID))
        .willReturn(Optional.of(workflow));

    service.apply(
        DRAFT_VERSION_ID,
        patch(
            new StructuralPatchOperation.WorkflowNode(
                StructuralPatchOperationType.ADD_WORKFLOW_NODE,
                null,
                12L,
                "answer_x",
                "ANSWER",
                null,
                "안내드립니다",
                "reason"),
            new StructuralPatchOperation.WorkflowTransition(
                StructuralPatchOperationType.ADD_TRANSITION,
                null,
                12L,
                "start",
                "answer_x",
                null,
                "reason")));

    JsonNode graph = objectMapper.readTree(workflow.getGraphJson());
    assertThat(nodeExists(graph, "answer_x")).isTrue();
    verify(workflowRepository).save(workflow);
  }

  // --- helpers ---

  private StructuralDomainPackPatch patch(StructuralPatchOperation... ops) {
    return new StructuralDomainPackPatch(
        StructuralDomainPackPatch.SCHEMA_VERSION,
        "summary",
        new StructuralPatchEvidence(1L, 2L, null, null, "failure"),
        List.of(ops));
  }

  private StructuralPatchOperation element(
      StructuralPatchOperationType type, String targetCode, String value) {
    return new StructuralPatchOperation.ElementAttribute(
        type, type.getCategory(), targetCode, null, value, "reason");
  }

  private StructuralPatchOperation elementById(
      StructuralPatchOperationType type, Long targetId, String value) {
    return new StructuralPatchOperation.ElementAttribute(
        type, type.getCategory(), null, targetId, value, "reason");
  }

  private IntentDefinition intent(String metaJson, String description) {
    return IntentDefinition.create(
        DRAFT_VERSION_ID, "greet", "인사", description, 1, "{}", "{}", "[]", metaJson);
  }

  private SlotDefinition slot(String validationRuleJson) {
    return SlotDefinition.create(
        DRAFT_VERSION_ID, "pickup", "픽업 일자", "설명", "STRING", false, validationRuleJson, null, "{}");
  }

  private PolicyDefinition policy() {
    return PolicyDefinition.create(
        DRAFT_VERSION_ID, "p1", "정책", "설명", "MEDIUM", "{}", "{}", "[]", "{}");
  }

  private RiskDefinition risk() {
    return RiskDefinition.create(
        DRAFT_VERSION_ID, "r1", "위험", "설명", "MEDIUM", "{}", "{}", "[]", "{}");
  }

  private WorkflowDefinition workflow(String graphJson) {
    return WorkflowDefinition.create(
        DRAFT_VERSION_ID,
        "wf",
        "워크플로우",
        "설명",
        graphJson,
        "start",
        "[\"end\"]",
        "[]",
        "{}",
        1L,
        true,
        "{}");
  }

  private boolean nodeExists(JsonNode graph, String id) {
    for (JsonNode node : graph.path("nodes")) {
      if (id.equals(node.path("id").asText(null))) {
        return true;
      }
    }
    return false;
  }

  private String nodeCopy(JsonNode graph, String id) {
    for (JsonNode node : graph.path("nodes")) {
      if (id.equals(node.path("id").asText(null))) {
        return node.path("copy").asText(null);
      }
    }
    return null;
  }
}
