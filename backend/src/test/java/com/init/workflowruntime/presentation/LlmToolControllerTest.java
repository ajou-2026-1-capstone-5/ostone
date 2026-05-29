package com.init.workflowruntime.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.application.exception.NotFoundException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolPolicyContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolIntentsCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentSelectionResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = LlmToolController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("LlmToolController")
class LlmToolControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @MockitoBean private LlmToolService llmToolService;

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/workflow → 200 OK")
  void getCurrentWorkflow_returnsOk() throws Exception {
    // given
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
        .willReturn(
            new LlmToolWorkflowResponse(
                1L,
                10L,
                42L,
                101L,
                50L,
                "RUNNING",
                "collect_slots",
                77L,
                "refund_v1",
                "환불 처리 워크플로우",
                "환불 요청 처리",
                objectMapper.readTree("{\"nodes\":[]}"),
                "collect_slots",
                objectMapper.readTree("[\"refund_granted\"]")));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/workflow"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.domainPackId").value(42))
        .andExpect(jsonPath("$.executionId").value(50))
        .andExpect(jsonPath("$.workflowCode").value("refund_v1"))
        .andExpect(jsonPath("$.currentState").value("collect_slots"))
        .andExpect(jsonPath("$.graphJson.nodes").isArray());
  }

  @Test
  @DisplayName("GET /workflow session 없으면 404")
  void getCurrentWorkflow_returnsNotFound_whenSessionMissing() throws Exception {
    // given
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(99L)))
        .willThrow(new NotFoundException("SESSION_NOT_FOUND", "Session not found: 99"));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/99/workflow"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("SESSION_NOT_FOUND"));
  }

  @Test
  @DisplayName("GET /workflow execution 없으면 200 + null 필드")
  void getCurrentWorkflow_returnsOk_withNulls_whenNoExecution() throws Exception {
    // given
    given(llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(1L)))
        .willReturn(
            new LlmToolWorkflowResponse(
                1L, 10L, 42L, 101L, null, null, null, null, null, null, null, null, null, null));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/workflow"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.domainPackId").value(42))
        .andExpect(jsonPath("$.executionId").doesNotExist())
        .andExpect(jsonPath("$.workflowCode").doesNotExist());
  }

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/context → 200 OK")
  void should_returnContext_when_validRequest() throws Exception {
    // given
    given(llmToolService.getContext(new GetLlmToolContextCommand(1L)))
        .willReturn(
            new LlmToolContextResponse(
                1L,
                10L,
                101L,
                50L,
                "RUNNING",
                "collect_slots",
                objectMapper.readTree("{\"order_id\":\"A-100\"}"),
                objectMapper.readTree("{\"hits\":[]}"),
                null,
                List.of("customer_name"),
                List.of(slotResponse("order_id", true))));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/context"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.slotValues.order_id").value("A-100"))
        .andExpect(jsonPath("$.missingSlots[0]").value("customer_name"))
        .andExpect(jsonPath("$.slots[0].slotCode").value("order_id"));
  }

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/policy-context → 200 OK")
  void should_returnPolicyContext_when_validRequest() throws Exception {
    given(llmToolService.getPolicyContext(new GetLlmToolPolicyContextCommand(1L)))
        .willReturn(
            new LlmToolPolicyContextResponse(
                1L,
                50L,
                "confirm_cancel",
                objectMapper.readTree(
                    "{\"hits\":[{\"policyCode\":\"cancel_policy\",\"nodeId\":\"confirm_cancel\"}]}"),
                null));

    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/policy-context"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.currentState").value("confirm_cancel"))
        .andExpect(jsonPath("$.policySnapshot.hits[0].policyCode").value("cancel_policy"));
  }

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/slots → 200 OK")
  void should_returnSlots_when_validRequest() throws Exception {
    // given
    given(llmToolService.listSlots(new ListLlmToolSlotsCommand(1L)))
        .willReturn(List.of(slotResponse("order_id", true)));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/slots"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].slotCode").value("order_id"))
        .andExpect(jsonPath("$[0].hasValue").value(true));
  }

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/slots/{slotCode} → 200 OK")
  void should_returnSlot_when_validRequest() throws Exception {
    // given
    given(llmToolService.getSlot(new GetLlmToolSlotCommand(1L, "order_id")))
        .willReturn(slotResponse("order_id", true));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/slots/order_id"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.slotCode").value("order_id"))
        .andExpect(jsonPath("$.hasValue").value(true))
        .andExpect(jsonPath("$.value").value("A-100"));
  }

  @Test
  @DisplayName("GET /api/v1/llm-tools/sessions/{sessionId}/intents → 200 OK")
  void should_returnIntents_when_validRequest() throws Exception {
    // given
    given(llmToolService.listIntents(new ListLlmToolIntentsCommand(1L)))
        .willReturn(
            List.of(
                new LlmToolIntentResponse(
                    70L,
                    "request_refund",
                    "환불 요청",
                    "환불 요청 intent",
                    1,
                    null,
                    "PUBLISHED",
                    objectMapper.readTree("{}"),
                    objectMapper.readTree("{}"))));

    // when & then
    mockMvc
        .perform(get("/api/v1/llm-tools/sessions/1/intents"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].intentCode").value("request_refund"))
        .andExpect(jsonPath("$[0].name").value("환불 요청"));
  }

  @Test
  @DisplayName("POST /api/v1/llm-tools/sessions/{sessionId}/intent-selection → 200 OK")
  void should_selectIntent_when_validRequest() throws Exception {
    // given
    given(llmToolService.selectIntent(any(SelectLlmToolIntentCommand.class)))
        .willReturn(
            new LlmToolIntentSelectionResponse(
                1L,
                50L,
                70L,
                "request_refund",
                "환불 요청",
                150L,
                "refund_flow",
                "start",
                true,
                List.of("order_id"),
                List.of(slotResponse("order_id", false))));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/llm-tools/sessions/1/intent-selection")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"intentCode\":\"request_refund\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.intentCode").value("request_refund"))
        .andExpect(jsonPath("$.workflowCode").value("refund_flow"))
        .andExpect(jsonPath("$.currentState").value("start"))
        .andExpect(jsonPath("$.missingRequiredSlots[0]").value("order_id"));
  }

  @Test
  @DisplayName("PUT /api/v1/llm-tools/sessions/{sessionId}/slots/{slotCode} → 200 OK")
  void should_upsertSlotValue_when_validRequest() throws Exception {
    // given
    given(llmToolService.upsertSlotValue(any(UpsertLlmToolSlotValueCommand.class)))
        .willReturn(
            new LlmToolSlotValueResponse(
                1L, 50L, "order_id", true, objectMapper.readTree("\"A-200\"")));

    // when & then
    mockMvc
        .perform(
            put("/api/v1/llm-tools/sessions/1/slots/order_id")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"value\":\"A-200\"}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.executionId").value(50))
        .andExpect(jsonPath("$.slotCode").value("order_id"))
        .andExpect(jsonPath("$.value").value("A-200"));
  }

  @Test
  @DisplayName("PUT /api/v1/llm-tools/sessions/{sessionId}/slots/{slotCode} value 누락 → 400")
  void should_return400_when_valueMissing() throws Exception {
    mockMvc
        .perform(
            put("/api/v1/llm-tools/sessions/1/slots/order_id")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  private LlmToolSlotResponse slotResponse(String slotCode, boolean hasValue) throws Exception {
    return new LlmToolSlotResponse(
        11L,
        slotCode,
        "주문번호",
        "주문 식별자",
        "STRING",
        false,
        objectMapper.readTree("{\"type\":\"string\"}"),
        null,
        objectMapper.readTree("{}"),
        "ACTIVE",
        true,
        1,
        "주문번호를 물어본다",
        hasValue,
        hasValue ? objectMapper.readTree("\"A-100\"") : null);
  }
}
