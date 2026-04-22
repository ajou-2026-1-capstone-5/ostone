package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import com.init.domainpack.application.exception.WorkflowTransitionNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkflowTransitionUseCase")
class GetWorkflowTransitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private GetWorkflowTransitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 3001L;
  private static final Long USER_ID = 10L;
  private static final String TRANSITION_ID = "e_check_to_answer";

  private static final String GRAPH_WITH_LABEL =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"check\",\"type\":\"DECISION\"},"
          + "{\"id\":\"answer\",\"type\":\"ACTION\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_check_to_answer\",\"from\":\"check\",\"to\":\"answer\",\"label\":\"eligible\"},"
          + "{\"id\":\"e_answer_to_end\",\"from\":\"answer\",\"to\":\"end\"}]}";

  private static final String GRAPH_WITHOUT_LABEL =
      "{\"direction\":\"LR\","
          + "\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_check_to_answer\",\"from\":\"start\",\"to\":\"end\"}]}";

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetWorkflowTransitionUseCase(validator, workflowDefinitionRepository);
  }

  @Test
  @DisplayName("정상 조회 (label 있음) — 전 필드 반환")
  void should_detail반환_when_label있음() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_WITH_LABEL)));

    // when
    WorkflowTransitionDetail result = useCase.execute(query(TRANSITION_ID));

    // then
    assertThat(result.id()).isEqualTo("e_check_to_answer");
    assertThat(result.workflowDefinitionId()).isEqualTo(WORKFLOW_ID);
    assertThat(result.domainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(result.from()).isEqualTo("check");
    assertThat(result.to()).isEqualTo("answer");
    assertThat(result.label()).isEqualTo("eligible");
  }

  @Test
  @DisplayName("정상 조회 (label 없음) — label == null")
  void should_label이null_when_label없음() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_WITHOUT_LABEL)));

    // when
    WorkflowTransitionDetail result = useCase.execute(query(TRANSITION_ID));

    // then
    assertThat(result.label()).isNull();
  }

  @Test
  @DisplayName("transitionId 미존재 → WorkflowTransitionNotFoundException")
  void should_WorkflowTransitionNotFoundException발생_when_transitionId미존재() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_WITH_LABEL)));

    // when & then
    assertThatThrownBy(() -> useCase.execute(query("non_existent_edge")))
        .isInstanceOf(WorkflowTransitionNotFoundException.class);
  }

  @Test
  @DisplayName("workflowId 미존재 → WorkflowDefinitionNotFoundException")
  void should_WorkflowDefinitionNotFoundException발생_when_workflowId미존재() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(WorkflowDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("DB 저장된 graphJson 파싱 오류 → WorkflowGraphJsonInvalidException")
  void should_WorkflowGraphJsonInvalidException발생_when_graphJson파싱오류() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, "not-valid-json{")));

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(WorkflowGraphJsonInvalidException.class);
  }

  @Test
  @DisplayName("workspace 미존재 → DomainPackWorkspaceNotFoundException")
  void should_DomainPackWorkspaceNotFoundException발생_when_workspace미존재() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_DomainPackUnauthorizedWorkspaceAccessException발생_when_접근권한없음() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);
  }

  @Test
  @DisplayName("pack 소속 불일치 → DomainPackNotFoundException")
  void should_DomainPackNotFoundException발생_when_pack소속불일치() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(DomainPackNotFoundException.class);
  }

  @Test
  @DisplayName("version 소속 불일치 → DomainPackVersionNotFoundException")
  void should_DomainPackVersionNotFoundException발생_when_version소속불일치() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, 999L, DomainPackVersion.STATUS_DRAFT)));

    // when & then
    assertThatThrownBy(() -> useCase.execute(query(TRANSITION_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private GetWorkflowTransitionQuery query(String transitionId) {
    return new GetWorkflowTransitionQuery(
        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, transitionId, USER_ID);
  }

  private void stubValidWorkspace() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(
            Optional.of(
                DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, DomainPackVersion.STATUS_DRAFT)));
  }

  private WorkflowDefinition createWorkflow(Long id, String graphJson) {
    WorkflowDefinition wf =
        WorkflowDefinition.create(
            VERSION_ID, "wf_refund", "환불 플로우", null, graphJson, "start", "[\"end\"]", null, null);
    ReflectionTestUtils.setField(wf, "id", id);
    return wf;
  }
}
