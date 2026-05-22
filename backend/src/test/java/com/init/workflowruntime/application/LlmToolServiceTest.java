package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.WorkflowExecution;
import com.init.workflowruntime.domain.WorkflowExecutionRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
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
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;

  private ObjectMapper objectMapper;
  private LlmToolService service;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    service =
        new LlmToolService(
            chatSessionRepository,
            workflowExecutionRepository,
            slotDefinitionRepository,
            intentSlotBindingRepository,
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
}
