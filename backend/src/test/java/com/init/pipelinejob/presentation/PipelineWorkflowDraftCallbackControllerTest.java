package com.init.pipelinejob.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.exception.WorkflowCycleDetectedException;
import com.init.pipelinejob.application.ReceiveWorkflowDraftCallbackResult;
import com.init.pipelinejob.application.ReceiveWorkflowDraftCallbackUseCase;
import com.init.pipelinejob.application.exception.AirflowWebhookUnauthorizedException;
import com.init.pipelinejob.application.exception.PipelineJobCallbackNotAllowedException;
import com.init.pipelinejob.application.exception.WebhookReceiptTypeConflictException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.web.WebhookHeaderNames;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = PipelineWorkflowDraftCallbackController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("PipelineWorkflowDraftCallbackController")
class PipelineWorkflowDraftCallbackControllerTest {

  private static final String BASE_URL = "/api/v1/pipeline-jobs/11/callbacks/workflow-drafts";

  private final MockMvc mockMvc;

  @Autowired
  PipelineWorkflowDraftCallbackControllerTest(MockMvc mockMvc) {
    this.mockMvc = mockMvc;
  }

  @MockitoBean private ReceiveWorkflowDraftCallbackUseCase workflowUseCase;

  @Test
  @DisplayName("유효한 workflow draft 요청이면 201을 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_validRequest_returns201() throws Exception {
    given(workflowUseCase.execute(any()))
        .willReturn(
            ReceiveWorkflowDraftCallbackResult.created(
                "evt-workflow-1", 7L, 101L, 1, 1, 1, 1, 1, 1, 11L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.status").value("CREATED"))
        .andExpect(jsonPath("$.domainPackId").value(7))
        .andExpect(jsonPath("$.domainPackVersionId").value(101))
        .andExpect(jsonPath("$.addedWorkflowCount").value(1))
        .andExpect(jsonPath("$.addedIntentWorkflowBindingCount").value(1));
  }

  @Test
  @DisplayName("중복 callback이면 200을 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_duplicate_returns200() throws Exception {
    given(workflowUseCase.execute(any()))
        .willReturn(ReceiveWorkflowDraftCallbackResult.duplicateIgnored("evt-workflow-1"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("DUPLICATE_IGNORED"));
  }

  @Test
  @DisplayName("요청 검증 실패면 400을 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_validationFailure_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content("{\"externalEventId\":\"\",\"domainPackVersionId\":0}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("시크릿이 잘못되면 401을 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_invalidSecret_returns401() throws Exception {
    given(workflowUseCase.execute(any())).willThrow(new AirflowWebhookUnauthorizedException());

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "wrong-secret")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("현재 상태에서 허용되지 않은 callback이면 409를 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_notAllowed_returns409() throws Exception {
    given(workflowUseCase.execute(any()))
        .willThrow(
            new PipelineJobCallbackNotAllowedException(
                11L, "WAITING_INTENT_CALLBACK", "WORKFLOW_DRAFT_CALLBACK"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("PIPELINE_JOB_CALLBACK_NOT_ALLOWED"));
  }

  @Test
  @DisplayName("externalEventId가 다른 callback type으로 수신됐으면 409를 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_typeConflict_returns409() throws Exception {
    given(workflowUseCase.execute(any()))
        .willThrow(
            new WebhookReceiptTypeConflictException(
                "evt-workflow-1", "INTENT_DRAFT_CALLBACK", "WORKFLOW_DRAFT_CALLBACK"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("WEBHOOK_RECEIPT_TYPE_CONFLICT"));
  }

  @Test
  @DisplayName("graphJson 검증 실패면 해당 workflow 에러 코드를 반환한다")
  @WithMockUser
  void receiveWorkflowDraftCallback_graphValidationFailure_returns400() throws Exception {
    given(workflowUseCase.execute(any()))
        .willThrow(new WorkflowCycleDetectedException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .header(WebhookHeaderNames.AIRFLOW_WEBHOOK_SECRET, "secret-123")
                .contentType("application/json")
                .content(validWorkflowRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_CYCLE_DETECTED"));
  }

  private String validWorkflowRequestJson() {
    return """
        {
          "externalEventId": "evt-workflow-1",
          "domainPackVersionId": 101,
          "slots": [
            {
              "slotCode": "order_id",
              "name": "주문번호",
              "dataType": "STRING"
            }
          ],
          "policies": [
            {
              "policyCode": "refund_policy_default",
              "name": "기본 환불 정책"
            }
          ],
          "risks": [
            {
              "riskCode": "fraud_high_amount",
              "name": "고액 사기 위험",
              "riskLevel": "HIGH"
            }
          ],
          "workflows": [
            {
              "workflowCode": "refund_flow",
              "name": "환불 플로우",
              "graphJson": "{\\"nodes\\":[{\\"id\\":\\"start\\",\\"type\\":\\"START\\"},{\\"id\\":\\"answer_refund\\",\\"type\\":\\"ACTION\\",\\"policyRef\\":\\"refund_policy_default\\"},{\\"id\\":\\"terminal\\",\\"type\\":\\"TERMINAL\\"}],\\"edges\\":[{\\"id\\":\\"e1\\",\\"from\\":\\"start\\",\\"to\\":\\"answer_refund\\"},{\\"id\\":\\"e2\\",\\"from\\":\\"answer_refund\\",\\"to\\":\\"terminal\\"}]}"
            }
          ],
          "intentSlotBindings": [
            {
              "intentCode": "refund_request",
              "slotCode": "order_id",
              "isRequired": true
            }
          ],
          "intentWorkflowBindings": [
            {
              "intentCode": "refund_request",
              "workflowCode": "refund_flow",
              "isPrimary": true
            }
          ]
        }
        """;
  }
}
