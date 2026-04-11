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
