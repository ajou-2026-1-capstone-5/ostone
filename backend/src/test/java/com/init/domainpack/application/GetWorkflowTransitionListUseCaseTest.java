package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.application.exception.WorkflowActionNodePolicyRefMissingException;
import com.init.domainpack.application.exception.WorkflowDefinitionNotFoundException;
import com.init.domainpack.application.exception.WorkflowGraphJsonInvalidException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
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
@DisplayName("GetWorkflowTransitionListUseCase")
class GetWorkflowTransitionListUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private GetWorkflowTransitionListUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 3001L;
  private static final Long USER_ID = 10L;

  private static final String GRAPH_MIXED =
      "{\"nodes\":["
          + "{\"id\":\"check\",\"type\":\"DECISION\"},"
          + "{\"id\":\"answer\",\"type\":\"ACTION\",\"policyRef\":\"refund_policy\"},"
          + "{\"id\":\"handoff\",\"type\":\"ACTION\",\"policyRef\":\"handoff_policy\"},"
          + "{\"id\":\"terminal\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_check_to_answer\",\"from\":\"check\",\"to\":\"answer\",\"label\":\"eligible\"},"
          + "{\"id\":\"e_check_to_handoff\",\"from\":\"check\",\"to\":\"handoff\",\"label\":\"not_eligible\"},"
          + "{\"id\":\"e_answer_to_end\",\"from\":\"answer\",\"to\":\"terminal\"}]}";

  private static final String GRAPH_EMPTY_EDGES =
      "{\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":[]}";

  private static final String GRAPH_WITH_LEGACY_EDGE =
      "{\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_valid\",\"from\":\"start\",\"to\":\"end\"},"
          + "{\"from\":\"start\",\"to\":\"end\"}]}";

  private static final String GRAPH_CORRUPT_ACTION =
      "{\"nodes\":["
          + "{\"id\":\"start\",\"type\":\"START\"},"
          + "{\"id\":\"action\",\"type\":\"ACTION\"},"
          + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":["
          + "{\"id\":\"e_1\",\"from\":\"start\",\"to\":\"action\"},"
          + "{\"id\":\"e_2\",\"from\":\"action\",\"to\":\"end\"}]}";

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetWorkflowTransitionListUseCase(validator, workflowDefinitionRepository);
  }

  @Test
  @DisplayName("정상 조회 — ACTION 목적지 edge의 toPolicyRef 반환, DECISION 발신 edge의 label 반환")
  void should_목록반환_when_정상조회() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_MIXED)));

    // when
    List<WorkflowTransitionDetail> result = useCase.execute(query());

    // then
    assertThat(result).hasSize(3);

    WorkflowTransitionDetail first = result.get(0);
    assertThat(first.id()).isEqualTo("e_check_to_answer");
    assertThat(first.workflowDefinitionId()).isEqualTo(WORKFLOW_ID);
    assertThat(first.domainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(first.from()).isEqualTo("check");
    assertThat(first.to()).isEqualTo("answer");
    assertThat(first.label()).isEqualTo("eligible");
    assertThat(first.toPolicyRef()).isEqualTo("refund_policy");

    WorkflowTransitionDetail second = result.get(1);
    assertThat(second.label()).isEqualTo("not_eligible");
    assertThat(second.toPolicyRef()).isEqualTo("handoff_policy");

    WorkflowTransitionDetail third = result.get(2);
    assertThat(third.label()).isNull();
    assertThat(third.toPolicyRef()).isNull();
  }

  @Test
  @DisplayName("transitions 없음 (edges 빈 배열) → 빈 List 반환")
  void should_빈목록반환_when_edges빈배열() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_EMPTY_EDGES)));

    // when
    List<WorkflowTransitionDetail> result = useCase.execute(query());

    // then
    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("id 없는 edge 혼재 → id 있는 edge만 반환")
  void should_id있는edge만반환_when_id없는edge혼재() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_WITH_LEGACY_EDGE)));

    // when
    List<WorkflowTransitionDetail> result = useCase.execute(query());

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).id()).isEqualTo("e_valid");
  }

  @Test
  @DisplayName("workflowId 미존재 → WorkflowDefinitionNotFoundException")
  void should_WorkflowDefinitionNotFoundException발생_when_workflowId미존재() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> useCase.execute(query()))
        .isInstanceOf(WorkflowDefinitionNotFoundException.class);
  }

  @Test
  @DisplayName("DB graphJson 파싱 오류 → WorkflowGraphJsonInvalidException")
  void should_WorkflowGraphJsonInvalidException발생_when_graphJson파싱오류() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, "not-valid-json{")));

    // when & then
    assertThatThrownBy(() -> useCase.execute(query()))
        .isInstanceOf(WorkflowGraphJsonInvalidException.class);
  }

  @Test
  @DisplayName(
      "DB ACTION 노드에 policyRef 없음 (corrupt data) → WorkflowActionNodePolicyRefMissingException")
  void should_WorkflowActionNodePolicyRefMissingException발생_when_ACTION노드policyRef없음() {
    // given
    stubValidWorkspace();
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, GRAPH_CORRUPT_ACTION)));

    // when & then
    assertThatThrownBy(() -> useCase.execute(query()))
        .isInstanceOf(WorkflowActionNodePolicyRefMissingException.class);
  }

  @Test
  @DisplayName("workspace 미존재 → DomainPackWorkspaceNotFoundException")
  void should_DomainPackWorkspaceNotFoundException발생_when_workspace미존재() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    // when & then
    assertThatThrownBy(() -> useCase.execute(query()))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void should_DomainPackUnauthorizedWorkspaceAccessException발생_when_접근권한없음() {
    // given
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    // when & then
    assertThatThrownBy(() -> useCase.execute(query()))
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
    assertThatThrownBy(() -> useCase.execute(query()))
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
    assertThatThrownBy(() -> useCase.execute(query()))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  // ── helpers ─────────────────────────────────────────────────────────────────

  private GetWorkflowTransitionListQuery query() {
    return new GetWorkflowTransitionListQuery(
        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID);
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
    Long versionId = VERSION_ID;
    String workflowCode = "wf_refund";
    String name = "환불 플로우";
    String description = null;
    String initialState = "start";
    String terminalStatesJson = "[\"end\"]";
    String evidenceJson = null;
    String metaJson = null;
    WorkflowDefinition wf =
        WorkflowDefinition.create(
            versionId,
            workflowCode,
            name,
            description,
            graphJson,
            initialState,
            terminalStatesJson,
            evidenceJson,
            metaJson);
    ReflectionTestUtils.setField(wf, "id", id);
    return wf;
  }
}
