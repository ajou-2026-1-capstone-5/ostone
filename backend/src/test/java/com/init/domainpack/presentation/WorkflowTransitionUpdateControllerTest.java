package com.init.domainpack.presentation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.domainpack.application.GetWorkflowDefinitionListUseCase;
import com.init.domainpack.application.GetWorkflowDefinitionUseCase;
import com.init.domainpack.application.GetWorkflowTransitionListUseCase;
import com.init.domainpack.application.GetWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowTransitionCommand;
import com.init.domainpack.application.UpdateWorkflowTransitionUseCase;
import com.init.domainpack.application.UpdateWorkflowUseCase;
import com.init.domainpack.application.WorkflowTransitionDetail;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
import com.init.fixtures.WithLongPrincipal;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(
    value = WorkflowDefinitionController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@DisplayName("WorkflowDefinitionController PATCH /{workflowId}/transitions/{transitionId}")
class WorkflowTransitionUpdateControllerTest {

  private static final String BASE_URL =
      "/api/v1/workspaces/1/domain-packs/7/versions/10/workflows/99/transitions/e_check_action";

  @Autowired private MockMvc mockMvc;

  @MockitoBean private GetWorkflowDefinitionListUseCase listUseCase;
  @MockitoBean private GetWorkflowDefinitionUseCase detailUseCase;
  @MockitoBean private UpdateWorkflowUseCase updateUseCase;
  @MockitoBean private GetWorkflowTransitionUseCase transitionUseCase;
  @MockitoBean private GetWorkflowTransitionListUseCase transitionListUseCase;
  @MockitoBean private UpdateWorkflowTransitionUseCase updateTransitionUseCase;

  @Test
  @DisplayName("정상 요청 시 200 OK + 확장된 WorkflowTransitionDetail 반환")
  @WithLongPrincipal(5L)
  void should_200OK_when_validPatchRequest() throws Exception {
    ArgumentCaptor<UpdateWorkflowTransitionCommand> captor =
        ArgumentCaptor.forClass(UpdateWorkflowTransitionCommand.class);
    given(updateTransitionUseCase.execute(any())).willReturn(sampleTransition());

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    "{\"condition\":{\"label\":\" 가능 \"},"
                        + "\"action\":{\"policyRef\":\"policy_new\"}}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value("e_check_action"))
        .andExpect(jsonPath("$.fromType").value("DECISION"))
        .andExpect(jsonPath("$.toType").value("ACTION"))
        .andExpect(jsonPath("$.condition.editable").value(true))
        .andExpect(jsonPath("$.condition.label").value("가능"))
        .andExpect(jsonPath("$.action.editable").value(true))
        .andExpect(jsonPath("$.action.policyRef").value("policy_new"))
        .andExpect(jsonPath("$.outcome.editable").value(false));

    verify(updateTransitionUseCase).execute(captor.capture());
    UpdateWorkflowTransitionCommand command = captor.getValue();
    assertThat(command.workspaceId()).isEqualTo(1L);
    assertThat(command.packId()).isEqualTo(7L);
    assertThat(command.versionId()).isEqualTo(10L);
    assertThat(command.workflowId()).isEqualTo(99L);
    assertThat(command.transitionId()).isEqualTo("e_check_action");
    assertThat(command.requesterId()).isEqualTo(5L);
    assertThat(command.condition().label()).isEqualTo("가능");
    assertThat(command.action().policyRef()).isEqualTo("policy_new");
    assertThat(command.outcome()).isNull();
  }

  @Test
  @DisplayName("명시적 null section이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_explicitNullSection() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":null}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateTransitionUseCase);
  }

  @Test
  @DisplayName("명시적 null field이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_explicitNullField() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"outcome\":{\"state\":null,\"label\":\"완료\"}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateTransitionUseCase);
  }

  @Test
  @DisplayName("빈 본문이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_emptyBody() throws Exception {
    mockMvc
        .perform(patch(BASE_URL).with(csrf()).contentType(MediaType.APPLICATION_JSON))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateTransitionUseCase);
  }

  @Test
  @DisplayName("blank 문자열 field이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_blankField() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"condition\":{\"label\":\"   \"}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateTransitionUseCase);
  }

  @Test
  @DisplayName("outcome 빈 객체는 command에 빈 outcome으로 전달한다")
  @WithLongPrincipal(5L)
  void should_passEmptyOutcomeToUseCase_when_outcomeObjectEmpty() throws Exception {
    ArgumentCaptor<UpdateWorkflowTransitionCommand> captor =
        ArgumentCaptor.forClass(UpdateWorkflowTransitionCommand.class);
    given(updateTransitionUseCase.execute(any()))
        .willThrow(
            new BadRequestException("WORKFLOW_TRANSITION_OUTCOME_EMPTY", "outcome이 비어 있습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"outcome\":{}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_TRANSITION_OUTCOME_EMPTY"));

    verify(updateTransitionUseCase).execute(captor.capture());
    assertThat(captor.getValue().outcome()).isNotNull();
    assertThat(captor.getValue().outcome().state()).isNull();
    assertThat(captor.getValue().outcome().label()).isNull();
  }

  @Test
  @DisplayName("malformed JSON이면 400 VALIDATION_ERROR")
  @WithLongPrincipal(5L)
  void should_400_when_malformedJson() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"condition\":"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

    verifyNoInteractions(updateTransitionUseCase);
  }

  @Test
  @DisplayName("UseCase가 WORKFLOW_TRANSITION_NOT_FOUND를 던지면 404")
  @WithLongPrincipal(5L)
  void should_404_when_transitionNotFound() throws Exception {
    given(updateTransitionUseCase.execute(any()))
        .willThrow(new WorkflowTransitionNotFoundException("e_check_action"));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"condition\":{\"label\":\"가능\"}}"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.code").value("WORKFLOW_TRANSITION_NOT_FOUND"));
  }

  @Test
  @DisplayName("UseCase가 WORKFLOW_NOT_EDITABLE을 던지면 400")
  @WithLongPrincipal(5L)
  void should_400_when_workflowNotEditable() throws Exception {
    given(updateTransitionUseCase.execute(any()))
        .willThrow(new BadRequestException("WORKFLOW_NOT_EDITABLE", "DRAFT 상태의 버전에서만 수정할 수 있습니다."));

    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"condition\":{\"label\":\"가능\"}}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("WORKFLOW_NOT_EDITABLE"));
  }

  @Test
  @DisplayName("인증 없는 요청이면 401")
  void should_401_when_unauthenticated() throws Exception {
    mockMvc
        .perform(
            patch(BASE_URL)
                .with(csrf())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"condition\":{\"label\":\"가능\"}}"))
        .andExpect(status().isUnauthorized());

    verifyNoInteractions(updateTransitionUseCase);
  }

  private WorkflowTransitionDetail sampleTransition() {
    return new WorkflowTransitionDetail(
        "e_check_action",
        99L,
        10L,
        "check",
        "action",
        "DECISION",
        "ACTION",
        "가능",
        "policy_new",
        new WorkflowTransitionDetail.TransitionConditionDetail(true, "가능"),
        new WorkflowTransitionDetail.TransitionActionDetail(true, "policy_new"),
        new WorkflowTransitionDetail.TransitionOutcomeDetail(false, null, null));
  }
}
