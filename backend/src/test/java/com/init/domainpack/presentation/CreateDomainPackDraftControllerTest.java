package com.init.domainpack.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.CreateDomainPackDraftResult;
import com.init.domainpack.application.CreateDomainPackDraftUseCase;
import com.init.domainpack.application.exception.DomainPackDraftRequestInvalidException;
import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionConflictException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.WorkflowCycleDetectedException;
import com.init.domainpack.application.exception.WorkflowDanglingEdgeException;
import com.init.domainpack.application.exception.WorkflowInvalidStartNodeException;
import com.init.domainpack.application.exception.WorkflowInvalidTerminalNodeException;
import com.init.domainpack.application.exception.WorkflowUnlabeledBranchException;
import com.init.domainpack.application.exception.WorkflowUnreachableNodeException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = CreateDomainPackDraftController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("CreateDomainPackDraftController")
class CreateDomainPackDraftControllerTest {

  private static final String BASE_URL = "/api/v1/workspaces/1/domain-packs/7/versions/drafts";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private CreateDomainPackDraftUseCase useCase;

  @Test
  @DisplayName("유효한 초안 생성 요청이면 201을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_validRequest_returns201() throws Exception {
    given(useCase.execute(any()))
        .willReturn(
            new CreateDomainPackDraftResult(
                101L,
                7L,
                3,
                "DRAFT",
                55L,
                2,
                1,
                0,
                0,
                1,
                OffsetDateTime.parse("2026-04-10T09:00:00Z")));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.versionId").value(101))
        .andExpect(jsonPath("$.lifecycleStatus").value("DRAFT"))
        .andExpect(jsonPath("$.intentCount").value(2))
        .andExpect(jsonPath("$.workflowCount").value(1));
  }

  @Test
  @DisplayName("잘못된 참조가 있으면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_invalidReference_returns400() throws Exception {
    given(useCase.execute(any()))
        .willThrow(
            new DomainPackDraftRequestInvalidException("slot 참조를 찾을 수 없습니다. code=missing_slot"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_DRAFT_INVALID_REQUEST"));
  }

  @Test
  @DisplayName("존재하지 않는 도메인 팩이면 404를 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_packNotFound_returns404() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackNotFoundException(7L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_NOT_FOUND"));
  }

  @Test
  @DisplayName("권한이 없으면 403을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_unauthorized_returns403() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackUnauthorizedWorkspaceAccessException("워크스페이스에 접근 권한이 없습니다."));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.code").value("FORBIDDEN"));
  }

  @Test
  @DisplayName("workspace가 없으면 404를 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_workspaceNotFound_returns404() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new DomainPackWorkspaceNotFoundException("워크스페이스를 찾을 수 없습니다. id=1"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_WORKSPACE_NOT_FOUND"));
  }

  @Test
  @DisplayName("버전 충돌이면 409를 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_conflict_returns409() throws Exception {
    given(useCase.execute(any())).willThrow(new DomainPackVersionConflictException(7L));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("DOMAIN_PACK_CONFLICT"));
  }

  @Test
  @DisplayName("요청 바디 검증 실패면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_validationFailure_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"intents\":[{\"intentCode\":\"\",\"name\":\"\"}]}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("요청에 initialState 필드 포함 시 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_unexpectedInitialStateField_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workflows": [
                        {
                          "workflowCode": "refund_flow",
                          "name": "환불 플로우",
                          "graphJson": "{\\"nodes\\":[]}",
                          "initialState": "start"
                        }
                      ]
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("요청에 terminalStatesJson 필드 포함 시 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_unexpectedTerminalStatesJsonField_returns400() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "workflows": [
                        {
                          "workflowCode": "refund_flow",
                          "name": "환불 플로우",
                          "graphJson": "{\\"nodes\\":[]}",
                          "terminalStatesJson": "[\\"end\\"]"
                        }
                      ]
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("graphJson V1 위반 (START 노드 없음/복수) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_invalidStartNode_returns400() throws Exception {
    given(useCase.execute(any())).willThrow(new WorkflowInvalidStartNodeException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_INVALID_START_NODE"));
  }

  @Test
  @DisplayName("graphJson V2 위반 (TERMINAL 노드 없음) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_invalidTerminalNode_returns400() throws Exception {
    given(useCase.execute(any()))
        .willThrow(new WorkflowInvalidTerminalNodeException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_INVALID_TERMINAL_NODE"));
  }

  @Test
  @DisplayName("graphJson V3 위반 (dangling edge) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_danglingEdge_returns400() throws Exception {
    given(useCase.execute(any())).willThrow(new WorkflowDanglingEdgeException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_DANGLING_EDGE"));
  }

  @Test
  @DisplayName("graphJson V4 위반 (도달 불가 노드) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_unreachableNode_returns400() throws Exception {
    given(useCase.execute(any())).willThrow(new WorkflowUnreachableNodeException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_UNREACHABLE_NODE"));
  }

  @Test
  @DisplayName("graphJson V5 위반 (사이클 존재) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_cycleDetected_returns400() throws Exception {
    given(useCase.execute(any())).willThrow(new WorkflowCycleDetectedException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_CYCLE_DETECTED"));
  }

  @Test
  @DisplayName("graphJson V6 위반 (DECISION 무레이블 분기) 이면 400을 반환한다")
  @WithLongPrincipal(10L)
  void createDraft_unlabeledBranch_returns400() throws Exception {
    given(useCase.execute(any())).willThrow(new WorkflowUnlabeledBranchException("refund_flow"));

    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_UNLABELED_BRANCH"));
  }

  @Test
  @DisplayName("인증 없는 요청이면 401을 반환한다")
  void createDraft_unauthenticated_returns401() throws Exception {
    mockMvc
        .perform(
            post(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(validRequestJson()))
        .andExpect(status().isUnauthorized());
  }

  private String validRequestJson() {
    return """
        {
          "sourcePipelineJobId": 55,
          "summaryJson": "{\\"summary\\":\\"draft\\"}",
          "intents": [
            {
              "intentCode": "refund_request",
              "name": "환불 요청",
              "taxonomyLevel": 1
            },
            {
              "intentCode": "refund_request_cancel",
              "name": "환불 요청 취소",
              "taxonomyLevel": 2,
              "parentIntentCode": "refund_request"
            }
          ],
          "slots": [
            {
              "slotCode": "order_id",
              "name": "주문 번호",
              "dataType": "STRING"
            }
          ],
          "intentSlotBindings": [
            {
              "intentCode": "refund_request",
              "slotCode": "order_id",
              "isRequired": true,
              "collectionOrder": 1
            }
          ],
          "workflows": [
            {
              "workflowCode": "refund_flow",
              "name": "환불 플로우",
              "graphJson": "{\\"nodes\\":[]}"
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
