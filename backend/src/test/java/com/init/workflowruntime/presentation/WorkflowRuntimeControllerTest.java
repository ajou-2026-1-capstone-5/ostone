package com.init.workflowruntime.presentation;

import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.workflowruntime.application.WorkflowRuntimeService;
import com.init.workflowruntime.application.dto.LlmToolPolicyResponse;
import com.init.workflowruntime.application.dto.WorkflowAdvanceResponse;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkflowRuntimeController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("WorkflowRuntimeController")
class WorkflowRuntimeControllerTest {

  @Autowired private MockMvc mockMvc;

  @Autowired private ObjectMapper objectMapper;

  @MockitoBean private WorkflowRuntimeService workflowRuntimeService;

  @Test
  @DisplayName("POST /api/v1/workflow-runtime/sessions/{sessionId}/advance → 200 OK")
  void should_advanceWorkflow_when_validRequest() throws Exception {
    given(workflowRuntimeService.advance(1L))
        .willReturn(
            new WorkflowAdvanceResponse(
                1L,
                50L,
                "RUNNING",
                "collect_reservation_no",
                "collect_reservation_no",
                "ACTION",
                "ASK_SLOT",
                null,
                "collect_reservation_no",
                List.of("reservation_no"),
                objectMapper.readTree("null"),
                objectMapper.readTree("{}"),
                null,
                null,
                "required slot values are missing"));

    mockMvc
        .perform(post("/api/v1/workflow-runtime/sessions/1/advance"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.sessionId").value(1))
        .andExpect(jsonPath("$.actionType").value("ASK_SLOT"))
        .andExpect(jsonPath("$.missingSlotCodes[0]").value("reservation_no"));
  }

  @Test
  @DisplayName("POST /advance → policy_hit 전이 근거를 transitionPolicy로 반환한다")
  void should_returnTransitionPolicy_when_policyHitEdgeMatched() throws Exception {
    LlmToolPolicyResponse transitionPolicy =
        new LlmToolPolicyResponse(
            300L,
            "cancel_deadline_policy",
            "취소 마감 정책",
            "체크인 24시간 이내 취소는 상담사 확인이 필요하다.",
            "HIGH",
            objectMapper.createObjectNode(),
            objectMapper.createObjectNode(),
            objectMapper.createArrayNode(),
            objectMapper.createObjectNode(),
            "ACTIVE",
            "confirm_cancel_policy",
            true,
            List.of(),
            "policy condition matched");

    given(workflowRuntimeService.advance(1L))
        .willReturn(
            new WorkflowAdvanceResponse(
                1L,
                50L,
                "RUNNING",
                "confirm_cancel_policy",
                "handoff",
                "HANDOFF",
                "HANDOFF",
                "e_policy_handoff",
                "handoff",
                List.of(),
                objectMapper.readTree(
                    "{\"type\":\"policy_hit\",\"policyCode\":\"cancel_deadline_policy\"}"),
                objectMapper.readTree("{}"),
                transitionPolicy,
                null,
                "transitioned from confirm_cancel_policy to handoff"));

    mockMvc
        .perform(post("/api/v1/workflow-runtime/sessions/1/advance"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.actionType").value("HANDOFF"))
        .andExpect(jsonPath("$.condition.type").value("policy_hit"))
        .andExpect(jsonPath("$.transitionPolicy.policyCode").value("cancel_deadline_policy"));
  }
}
