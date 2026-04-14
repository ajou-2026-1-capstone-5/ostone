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
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkflowDefinitionUseCase")
class GetWorkflowDefinitionUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private GetWorkflowDefinitionUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long WORKFLOW_ID = 3001L;
  private static final Long USER_ID = 10L;
  private static final String VALID_GRAPH_JSON = "{\"direction\":\"LR\",\"nodes\":[],\"edges\":[]}";

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetWorkflowDefinitionUseCase(validator, workflowDefinitionRepository);
  }

  @Test
  @DisplayName("정상 조회 시 graphJson 포함 전체 필드 반환")
  void execute_withValidQuery_returnsDetail() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.of(createWorkflow(WORKFLOW_ID, "refund_flow", VALID_GRAPH_JSON)));

    WorkflowDefinitionDetail result =
        useCase.execute(
            new GetWorkflowDefinitionQuery(
                WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID));

    assertThat(result.id()).isEqualTo(WORKFLOW_ID);
    assertThat(result.workflowCode()).isEqualTo("refund_flow");
    assertThat(result.graphJson()).isEqualTo(VALID_GRAPH_JSON);
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void execute_workspaceNotFound_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID)))
        .isInstanceOf(DomainPackWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("접근 권한 없음 → DomainPackUnauthorizedWorkspaceAccessException")
  void execute_unauthorized_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID)))
        .isInstanceOf(DomainPackUnauthorizedWorkspaceAccessException.class);
  }

  @Test
  @DisplayName("domain pack 소속 불일치 → DomainPackNotFoundException")
  void execute_packNotInWorkspace_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID)))
        .isInstanceOf(DomainPackNotFoundException.class);
  }

  @Test
  @DisplayName("version 소속 불일치 → DomainPackVersionNotFoundException")
  void execute_versionNotInPack_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, 999L)));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  @Test
  @DisplayName("workflowId가 versionId에 속하지 않음 → WorkflowDefinitionNotFoundException")
  void execute_workflowNotInVersion_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(WORKFLOW_ID, VERSION_ID))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionQuery(
                        WORKSPACE_ID, PACK_ID, VERSION_ID, WORKFLOW_ID, USER_ID)))
        .isInstanceOf(WorkflowDefinitionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private WorkflowDefinition createWorkflow(Long id, String code, String graphJson) {
    WorkflowDefinition wf =
        WorkflowDefinition.create(
            VERSION_ID, code, "환불 플로우", null, graphJson, "start", "[\"terminal\"]", null, null);
    ReflectionTestUtils.setField(wf, "id", id);
    ReflectionTestUtils.setField(wf, "createdAt", OffsetDateTime.parse("2026-04-14T10:00:00Z"));
    ReflectionTestUtils.setField(wf, "updatedAt", OffsetDateTime.parse("2026-04-14T10:00:00Z"));
    return wf;
  }
}
