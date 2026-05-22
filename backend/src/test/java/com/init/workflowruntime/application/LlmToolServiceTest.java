package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.IntentWorkflowBinding;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.IntentWorkflowBindingRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.InternalException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolPolicyContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolIntentsCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentSelectionResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyContextResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("LlmToolService")
class LlmToolServiceTest {

  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private WorkflowExecutionRepository workflowExecutionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private IntentWorkflowBindingRepository intentWorkflowBindingRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private WorkflowPolicyRuntimeService workflowPolicyRuntimeService;

  private ObjectMapper objectMapper;
  private LlmToolService service;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    service =
        new LlmToolService(
            chatSessionRepository,
            workflowExecutionRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            intentSlotBindingRepository,
            intentWorkflowBindingRepository,
            workflowDefinitionRepository,
            workflowPolicyRuntimeService,
            objectMapper);
  }

  @Test
  @DisplayName("getContext: 세션 기준 slot 정의와 저장 값을 함께 반환한다")
  void should_returnContextWithSlotsAndValues() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution = createExecution(50L, 1L, 70L, "{\"order_id\":\"A-100\"}");
    SlotDefinition orderSlot = createSlot(11L, 101L, "order_id");
    SlotDefinition customerSlot = createSlot(12L, 101L, "customer_name");
    IntentSlotBinding orderBinding = createBinding(70L, 11L, true, 1, "주문번호를 물어본다");
    IntentSlotBinding customerBinding = createBinding(70L, 12L, true, 2, "고객명을 물어본다");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(101L))
        .willReturn(List.of(customerSlot, orderSlot));
    given(intentSlotBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of(orderBinding, customerBinding));

    // when
    LlmToolContextResponse result = service.getContext(new GetLlmToolContextCommand(1L));

    // then
    assertThat(result.sessionId()).isEqualTo(1L);
    assertThat(result.executionId()).isEqualTo(50L);
    assertThat(result.slotValues().get("order_id").asText()).isEqualTo("A-100");
    assertThat(result.missingSlots()).containsExactly("customer_name");
    assertThat(result.slots()).hasSize(2);
    assertThat(result.slots().get(0).slotCode()).isEqualTo("customer_name");
    assertThat(result.slots().get(0).required()).isTrue();
    assertThat(result.slots().get(1).hasValue()).isTrue();
  }

  @Test
  @DisplayName("listSlots: 실행이 없으면 active slot 정의만 값 없이 반환한다")
  void should_returnActiveSlotsWithoutValues_when_executionMissing() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    SlotDefinition activeSlot = createSlot(11L, 101L, "order_id");
    SlotDefinition inactiveSlot = createSlot(12L, 101L, "legacy_code");
    inactiveSlot.changeStatus(SlotDefinition.STATUS_INACTIVE);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(101L))
        .willReturn(List.of(activeSlot, inactiveSlot));

    // when
    List<LlmToolSlotResponse> result = service.listSlots(new ListLlmToolSlotsCommand(1L));

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).slotCode()).isEqualTo("order_id");
    assertThat(result.get(0).required()).isFalse();
    assertThat(result.get(0).hasValue()).isFalse();
    assertThat(result.get(0).value().isNull()).isTrue();
  }

  @Test
  @DisplayName("getPolicyContext: 실행이 없으면 세션과 빈 policy snapshot만 반환한다")
  void should_returnEmptyPolicyContext_when_executionMissing() {
    ChatSession session = createSession(1L, 10L, 101L);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());

    LlmToolPolicyContextResponse result =
        service.getPolicyContext(new GetLlmToolPolicyContextCommand(1L));

    assertThat(result.sessionId()).isEqualTo(1L);
    assertThat(result.executionId()).isNull();
    assertThat(result.currentState()).isNull();
    assertThat(result.policySnapshot().isObject()).isTrue();
    assertThat(result.policySnapshot()).isEmpty();
    assertThat(result.currentPolicy()).isNull();
  }

  @Test
  @DisplayName("getPolicyContext: 실행이 있으면 current policy와 policy snapshot을 반환한다")
  void should_returnPolicyContext_when_executionExists() throws Exception {
    ChatSession session = createSession(1L, 10L, 101L);
    WorkflowExecution execution = createExecution(50L, 1L, 70L, "{\"order_id\":\"A-100\"}");
    ReflectionTestUtils.setField(execution, "currentState", "policy_check");
    execution.replacePolicySnapshotJson("{\"hits\":[{\"policyCode\":\"refund_policy\"}]}");
    LlmToolPolicyResponse policyResponse =
        new LlmToolPolicyResponse(
            300L,
            "refund_policy",
            "환불 정책",
            "환불 가능 조건",
            "HIGH",
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            "ACTIVE",
            "policy_check",
            true,
            List.of(),
            "policy condition matched");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.of(execution));
    given(workflowPolicyRuntimeService.evaluateCurrentPolicy(eq(101L), eq(execution), any()))
        .willReturn(policyResponse);

    LlmToolPolicyContextResponse result =
        service.getPolicyContext(new GetLlmToolPolicyContextCommand(1L));

    assertThat(result.sessionId()).isEqualTo(1L);
    assertThat(result.executionId()).isEqualTo(50L);
    assertThat(result.currentState()).isEqualTo("policy_check");
    assertThat(result.policySnapshot().path("hits").get(0).path("policyCode").asText())
        .isEqualTo("refund_policy");
    assertThat(result.currentPolicy()).isEqualTo(policyResponse);
  }

  @Test
  @DisplayName("getSlot: inactive slotCode면 404 예외")
  void should_throwNotFound_when_slotIsInactive() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    SlotDefinition inactiveSlot = createSlot(11L, 101L, "order_id");
    inactiveSlot.changeStatus(SlotDefinition.STATUS_INACTIVE);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(101L, "order_id"))
        .willReturn(Optional.of(inactiveSlot));

    // when & then
    assertThatThrownBy(() -> service.getSlot(new GetLlmToolSlotCommand(1L, "order_id")))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("SlotDefinition not found");
  }

  @Test
  @DisplayName("upsertSlotValue: 기존 실행이 있으면 slot 값을 덮어쓴다")
  void should_updateExistingExecution_when_executionExists() throws Exception {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    SlotDefinition slot = createSlot(11L, 101L, "order_id");
    WorkflowExecution execution = createExecution(50L, 1L, 70L, "{\"order_id\":\"A-100\"}");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(101L, "order_id"))
        .willReturn(Optional.of(slot));
    given(workflowExecutionRepository.findLatestByChatSessionIdForUpdate(1L))
        .willReturn(Optional.of(execution));
    given(workflowExecutionRepository.save(execution)).willReturn(execution);

    JsonNode value = objectMapper.readTree("\"A-200\"");

    // when
    LlmToolSlotValueResponse result =
        service.upsertSlotValue(new UpsertLlmToolSlotValueCommand(1L, "order_id", value));

    // then
    assertThat(result.executionId()).isEqualTo(50L);
    assertThat(result.value().asText()).isEqualTo("A-200");
    assertThat(objectMapper.readTree(execution.getSlotValuesJson()).get("order_id").asText())
        .isEqualTo("A-200");
    verify(workflowExecutionRepository).save(execution);
  }

  @Test
  @DisplayName("upsertSlotValue: value가 null이면 400 예외")
  void should_throwBadRequest_when_valueIsNull() {
    assertThatThrownBy(
            () -> service.upsertSlotValue(new UpsertLlmToolSlotValueCommand(1L, "order_id", null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("slot value is required");
  }

  @Test
  @DisplayName("upsertSlotValue: 실행이 없으면 생성한 뒤 slot 값을 저장한다")
  void should_createExecutionAndUpsertSlotValue_when_executionMissing() throws Exception {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    SlotDefinition slot = createSlot(11L, 101L, "order_id");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(101L, "order_id"))
        .willReturn(Optional.of(slot));
    given(workflowExecutionRepository.findLatestByChatSessionIdForUpdate(1L))
        .willReturn(Optional.empty());
    given(workflowExecutionRepository.save(any(WorkflowExecution.class)))
        .willAnswer(
            invocation -> {
              WorkflowExecution execution = invocation.getArgument(0);
              if (execution.getId() == null) {
                ReflectionTestUtils.setField(execution, "id", 90L);
              }
              return execution;
            });

    JsonNode value = objectMapper.readTree("\"A-100\"");

    // when
    LlmToolSlotValueResponse result =
        service.upsertSlotValue(new UpsertLlmToolSlotValueCommand(1L, "order_id", value));

    // then
    assertThat(result.executionId()).isEqualTo(90L);
    assertThat(result.slotCode()).isEqualTo("order_id");
    assertThat(result.hasValue()).isTrue();
    assertThat(result.value().asText()).isEqualTo("A-100");
    verify(workflowExecutionRepository, times(2)).save(any(WorkflowExecution.class));
  }

  @Test
  @DisplayName("getSlot: 세션 domain pack version에 없는 slotCode면 404 예외")
  void should_throwNotFound_when_slotCodeMissing() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
        .willReturn(Optional.empty());
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(101L, "unknown"))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> service.getSlot(new GetLlmToolSlotCommand(1L, "unknown")))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("SlotDefinition not found");
  }

  @Test
  @DisplayName("listIntents: rejected intent를 제외하고 intentCode 순서로 반환한다")
  void should_returnCurrentDomainPackIntentsExceptRejected() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition refundIntent = createIntent(70L, 101L, "request_refund", "환불 요청");
    IntentDefinition addressIntent = createIntent(71L, 101L, "change_address", "배송지 변경");
    IntentDefinition rejectedIntent = createIntent(72L, 101L, "legacy_refund", "레거시 환불");
    rejectedIntent.changeStatus(IntentDefinition.STATUS_REJECTED);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionId(101L))
        .willReturn(List.of(refundIntent, rejectedIntent, addressIntent));

    // when
    var result = service.listIntents(new ListLlmToolIntentsCommand(1L));

    // then
    assertThat(result).hasSize(2);
    assertThat(result.get(0).intentCode()).isEqualTo("change_address");
    assertThat(result.get(1).intentCode()).isEqualTo("request_refund");
  }

  @Test
  @DisplayName(
      "selectIntent: intentCode 선택 시 execution에 intent/workflow/currentState를 저장하고 필수 slot 누락을 반환한다")
  void should_selectIntentAndReturnMissingRequiredSlots() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition intent = createIntent(70L, 101L, "request_refund", "환불 요청");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, "refund_flow", "start");
    IntentWorkflowBinding workflowBinding = createWorkflowBinding(70L, 150L, true);
    WorkflowExecution execution = createExecution(50L, 1L, null, "{\"order_id\":\"A-100\"}");
    SlotDefinition orderSlot = createSlot(11L, 101L, "order_id");
    SlotDefinition refundSlot = createSlot(12L, 101L, "refund_reason");
    IntentSlotBinding orderBinding = createBinding(70L, 11L, true, 1, "주문번호를 물어본다");
    IntentSlotBinding refundBinding = createBinding(70L, 12L, true, 2, "환불 사유를 확인한다");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "request_refund"))
        .willReturn(Optional.of(intent));
    given(intentWorkflowBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of(workflowBinding));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(workflowExecutionRepository.findLatestByChatSessionIdForUpdate(1L))
        .willReturn(Optional.of(execution));
    given(workflowExecutionRepository.save(execution)).willReturn(execution);
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(101L))
        .willReturn(List.of(refundSlot, orderSlot));
    given(intentSlotBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of(orderBinding, refundBinding));

    // when
    LlmToolIntentSelectionResponse result =
        service.selectIntent(new SelectLlmToolIntentCommand(1L, "request_refund"));

    // then
    assertThat(result.executionId()).isEqualTo(50L);
    assertThat(result.intentDefinitionId()).isEqualTo(70L);
    assertThat(result.workflowDefinitionId()).isEqualTo(150L);
    assertThat(result.currentState()).isEqualTo("start");
    assertThat(result.slotCollectionRequired()).isTrue();
    assertThat(result.missingRequiredSlots()).containsExactly("refund_reason");
    assertThat(execution.getIntentDefinitionId()).isEqualTo(70L);
    assertThat(execution.getWorkflowDefinitionId()).isEqualTo(150L);
  }

  @Test
  @DisplayName("selectIntent: workflow initialState가 없으면 START node id를 currentState로 사용한다")
  void should_useStartNodeAsCurrentState_when_initialStateMissing() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition intent = createIntent(70L, 101L, "request_refund", "환불 요청");
    WorkflowDefinition workflow = createWorkflow(150L, 101L, "refund_flow", null);
    WorkflowExecution execution = createExecution(50L, 1L, null, "{\"order_id\":\"A-100\"}");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "request_refund"))
        .willReturn(Optional.of(intent));
    given(intentWorkflowBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of(createWorkflowBinding(70L, 150L, true)));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.of(workflow));
    given(workflowExecutionRepository.findLatestByChatSessionIdForUpdate(1L))
        .willReturn(Optional.of(execution));
    given(workflowExecutionRepository.save(execution)).willReturn(execution);
    given(slotDefinitionRepository.findAllByDomainPackVersionIdOrderBySlotCodeAsc(101L))
        .willReturn(List.of());

    // when
    LlmToolIntentSelectionResponse result =
        service.selectIntent(new SelectLlmToolIntentCommand(1L, "request_refund"));

    // then
    assertThat(result.currentState()).isEqualTo("start");
    assertThat(result.slotCollectionRequired()).isFalse();
    assertThat(result.missingRequiredSlots()).isEmpty();
  }

  @Test
  @DisplayName("selectIntent: intentCode가 비어 있으면 400 예외")
  void should_throwBadRequest_when_intentCodeBlank() {
    assertThatThrownBy(() -> service.selectIntent(new SelectLlmToolIntentCommand(1L, " ")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("intentCode is required");
  }

  @Test
  @DisplayName("selectIntent: rejected intent는 선택할 수 없다")
  void should_throwBadRequest_when_intentIsRejected() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition intent = createIntent(70L, 101L, "request_refund", "환불 요청");
    intent.changeStatus(IntentDefinition.STATUS_REJECTED);

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "request_refund"))
        .willReturn(Optional.of(intent));

    // when & then
    assertThatThrownBy(
            () -> service.selectIntent(new SelectLlmToolIntentCommand(1L, "request_refund")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("Rejected intent cannot be selected");
  }

  @Test
  @DisplayName("selectIntent: intent workflow binding이 없으면 404 예외")
  void should_throwNotFound_when_workflowBindingMissing() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition intent = createIntent(70L, 101L, "request_refund", "환불 요청");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "request_refund"))
        .willReturn(Optional.of(intent));
    given(intentWorkflowBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of());

    // when & then
    assertThatThrownBy(
            () -> service.selectIntent(new SelectLlmToolIntentCommand(1L, "request_refund")))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Intent workflow binding not found");
  }

  @Test
  @DisplayName("selectIntent: binding workflow가 세션 version에 없으면 404 예외")
  void should_throwNotFound_when_workflowMissing() {
    // given
    ChatSession session = createSession(1L, 10L, 101L);
    IntentDefinition intent = createIntent(70L, 101L, "request_refund", "환불 요청");

    given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
    given(intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(101L, "request_refund"))
        .willReturn(Optional.of(intent));
    given(intentWorkflowBindingRepository.findAllByIntentDefinitionIdIn(List.of(70L)))
        .willReturn(List.of(createWorkflowBinding(70L, 150L, true)));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(150L, 101L))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(
            () -> service.selectIntent(new SelectLlmToolIntentCommand(1L, "request_refund")))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("WorkflowDefinition not found");
  }

  private ChatSession createSession(Long id, Long workspaceId, Long versionId) {
    ChatSession session =
        ChatSession.create(workspaceId, versionId, ChatSessionStatus.OPEN, "WEB", "{}");
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private WorkflowExecution createExecution(
      Long id, Long sessionId, Long intentDefinitionId, String slotValuesJson) {
    WorkflowExecution execution = WorkflowExecution.create(sessionId);
    ReflectionTestUtils.setField(execution, "id", id);
    ReflectionTestUtils.setField(execution, "intentDefinitionId", intentDefinitionId);
    execution.replaceSlotValuesJson(slotValuesJson);
    return execution;
  }

  private SlotDefinition createSlot(Long id, Long versionId, String slotCode) {
    SlotDefinition slot =
        SlotDefinition.create(
            versionId,
            slotCode,
            slotCode,
            "slot description",
            "STRING",
            false,
            "{\"type\":\"string\"}",
            null,
            "{}");
    ReflectionTestUtils.setField(slot, "id", id);
    return slot;
  }

  private IntentSlotBinding createBinding(
      Long intentDefinitionId,
      Long slotDefinitionId,
      Boolean required,
      Integer collectionOrder,
      String promptHint) {
    return IntentSlotBinding.create(
        intentDefinitionId, slotDefinitionId, required, collectionOrder, promptHint, "{}");
  }

  private IntentDefinition createIntent(Long id, Long versionId, String intentCode, String name) {
    IntentDefinition intent =
        IntentDefinition.create(
            versionId, intentCode, name, "intent description", 1, "{}", "{}", "[]", "{}");
    ReflectionTestUtils.setField(intent, "id", id);
    return intent;
  }

  private IntentWorkflowBinding createWorkflowBinding(
      Long intentDefinitionId, Long workflowDefinitionId, Boolean primary) {
    IntentWorkflowBinding binding =
        IntentWorkflowBinding.create(intentDefinitionId, workflowDefinitionId, primary, "{}");
    ReflectionTestUtils.setField(binding, "id", 300L);
    return binding;
  }

  private WorkflowDefinition createWorkflow(
      Long id, Long versionId, String workflowCode, String initialState) {
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            versionId,
            workflowCode,
            "workflow name",
            "workflow description",
            """
            {"direction":"LR","nodes":[{"id":"start","type":"START"},{"id":"end","type":"TERMINAL"}],"edges":[{"id":"e1","from":"start","to":"end"}]}
            """,
            initialState,
            "[\"end\"]",
            "[]",
            "{}");
    ReflectionTestUtils.setField(workflow, "id", id);
    return workflow;
  }

  @Nested
  @DisplayName("getCurrentWorkflow")
  class GetCurrentWorkflow {

    @Test
    @DisplayName("세션 + execution + workflow definition이 모두 있으면 graphJson 포함 응답")
    void returnsFullWorkflowWhenAllPresent() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, 70L, "{}");
      ReflectionTestUtils.setField(execution, "workflowDefinitionId", 77L);
      ReflectionTestUtils.setField(execution, "currentState", "collect_slots");
      WorkflowDefinition definition = createWorkflow(77L, 101L, "refund_v1", "collect_slots");
      ReflectionTestUtils.setField(definition, "name", "환불 처리 워크플로우");

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));
      given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(77L, 101L))
          .willReturn(Optional.of(definition));

      // when
      LlmToolWorkflowResponse result =
          service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L));

      // then
      assertThat(result.sessionId()).isEqualTo(1L);
      assertThat(result.workspaceId()).isEqualTo(10L);
      assertThat(result.domainPackVersionId()).isEqualTo(101L);
      assertThat(result.executionId()).isEqualTo(50L);
      assertThat(result.executionStatus()).isEqualTo("RUNNING");
      assertThat(result.currentState()).isEqualTo("collect_slots");
      assertThat(result.workflowDefinitionId()).isEqualTo(77L);
      assertThat(result.workflowCode()).isEqualTo("refund_v1");
      assertThat(result.graphJson()).isNotNull();
      assertThat(result.graphJson().isNull()).isFalse();
      assertThat(result.initialState()).isEqualTo("collect_slots");
      assertThat(result.terminalStates()).isNotNull();
      assertThat(result.terminalStates().isArray()).isTrue();
    }

    @Test
    @DisplayName("execution 없으면 execution/workflow 필드 모두 null")
    void returnsNullsWhenExecutionMissing() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.empty());

      // when
      LlmToolWorkflowResponse result =
          service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L));

      // then
      assertThat(result.sessionId()).isEqualTo(1L);
      assertThat(result.workspaceId()).isEqualTo(10L);
      assertThat(result.domainPackVersionId()).isEqualTo(101L);
      assertThat(result.executionId()).isNull();
      assertThat(result.executionStatus()).isNull();
      assertThat(result.currentState()).isNull();
      assertThat(result.workflowDefinitionId()).isNull();
      assertThat(result.graphJson()).isNull();
      assertThat(result.terminalStates()).isNull();
    }

    @Test
    @DisplayName("workflowDefinitionId가 null이면 execution 필드만 채우고 workflow는 null")
    void returnsExecutionOnlyWhenWorkflowNotBound() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, null, "{}");

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));

      // when
      LlmToolWorkflowResponse result =
          service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L));

      // then
      assertThat(result.executionId()).isEqualTo(50L);
      assertThat(result.executionStatus()).isEqualTo("RUNNING");
      assertThat(result.workflowDefinitionId()).isNull();
      assertThat(result.graphJson()).isNull();
      assertThat(result.terminalStates()).isNull();
    }

    @Test
    @DisplayName("workflowDefinitionId와 session domainPackVersionId가 불일치하면 workflow null")
    void returnsWorkflowNullOnCrossPackMismatch() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, 70L, "{}");
      ReflectionTestUtils.setField(execution, "workflowDefinitionId", 77L);

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));
      given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(77L, 101L))
          .willReturn(Optional.empty());

      // when
      LlmToolWorkflowResponse result =
          service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L));

      // then
      assertThat(result.executionId()).isEqualTo(50L);
      assertThat(result.workflowDefinitionId()).isNull();
      assertThat(result.graphJson()).isNull();
      assertThat(result.terminalStates()).isNull();
    }

    @Test
    @DisplayName("sessionId가 없으면 SESSION_NOT_FOUND")
    void throwsWhenSessionMissing() {
      // given
      given(chatSessionRepository.findById(99L)).willReturn(Optional.empty());

      // when & then
      assertThatThrownBy(() -> service.getCurrentWorkflow(new GetCurrentWorkflowCommand(99L)))
          .isInstanceOf(NotFoundException.class)
          .hasMessageContaining("Session not found");
    }

    @Test
    @DisplayName("graphJson이 malformed이면 JSON_PARSE_FAILED")
    void throwsWhenGraphJsonMalformed() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, 70L, "{}");
      ReflectionTestUtils.setField(execution, "workflowDefinitionId", 77L);
      WorkflowDefinition definition = createWorkflow(77L, 101L, "refund_v1", "start");
      ReflectionTestUtils.setField(definition, "graphJson", "not-valid-json");

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));
      given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(77L, 101L))
          .willReturn(Optional.of(definition));

      // when & then
      assertThatThrownBy(() -> service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
          .isInstanceOf(InternalException.class)
          .satisfies(
              ex -> assertThat(((InternalException) ex).getCode()).isEqualTo("JSON_PARSE_FAILED"));
    }

    @Test
    @DisplayName("terminalStatesJson이 malformed이면 JSON_PARSE_FAILED")
    void throwsWhenTerminalStatesJsonMalformed() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, 70L, "{}");
      ReflectionTestUtils.setField(execution, "workflowDefinitionId", 77L);
      WorkflowDefinition definition = createWorkflow(77L, 101L, "refund_v1", "start");
      ReflectionTestUtils.setField(definition, "terminalStatesJson", "not-valid-json");

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));
      given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(77L, 101L))
          .willReturn(Optional.of(definition));

      // when & then
      assertThatThrownBy(() -> service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
          .isInstanceOf(InternalException.class)
          .satisfies(
              ex -> assertThat(((InternalException) ex).getCode()).isEqualTo("JSON_PARSE_FAILED"));
    }

    @Test
    @DisplayName("terminalStatesJson이 array가 아니면 JSON_PARSE_FAILED")
    void throwsWhenTerminalStatesJsonNotArray() {
      // given
      ChatSession session = createSession(1L, 10L, 101L);
      WorkflowExecution execution = createExecution(50L, 1L, 70L, "{}");
      ReflectionTestUtils.setField(execution, "workflowDefinitionId", 77L);
      WorkflowDefinition definition = createWorkflow(77L, 101L, "refund_v1", "start");
      ReflectionTestUtils.setField(definition, "terminalStatesJson", "{\"key\":\"value\"}");

      given(chatSessionRepository.findById(1L)).willReturn(Optional.of(session));
      given(workflowExecutionRepository.findTopByChatSessionIdOrderByStartedAtDescIdDesc(1L))
          .willReturn(Optional.of(execution));
      given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(77L, 101L))
          .willReturn(Optional.of(definition));

      // when & then
      assertThatThrownBy(() -> service.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
          .isInstanceOf(InternalException.class)
          .satisfies(
              ex -> assertThat(((InternalException) ex).getCode()).isEqualTo("JSON_PARSE_FAILED"));
    }
  }
}
