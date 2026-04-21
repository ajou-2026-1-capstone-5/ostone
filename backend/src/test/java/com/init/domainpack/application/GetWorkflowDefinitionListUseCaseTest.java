package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;

import com.init.domainpack.application.exception.DomainPackNotFoundException;
import com.init.domainpack.application.exception.DomainPackUnauthorizedWorkspaceAccessException;
import com.init.domainpack.application.exception.DomainPackVersionNotFoundException;
import com.init.domainpack.application.exception.DomainPackWorkspaceNotFoundException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.repository.DomainPackRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionSummaryRow;
import com.init.domainpack.domain.repository.WorkspaceExistencePort;
import com.init.domainpack.domain.repository.WorkspaceMembershipPort;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetWorkflowDefinitionListUseCase")
class GetWorkflowDefinitionListUseCaseTest {

  @Mock private WorkspaceExistencePort workspaceExistencePort;
  @Mock private WorkspaceMembershipPort workspaceMembershipPort;
  @Mock private DomainPackRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;

  private GetWorkflowDefinitionListUseCase useCase;

  private static final Long WORKSPACE_ID = 1L;
  private static final Long PACK_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long USER_ID = 10L;

  @BeforeEach
  void setUp() {
    DomainPackValidator validator =
        new DomainPackValidator(
            workspaceExistencePort,
            workspaceMembershipPort,
            domainPackRepository,
            domainPackVersionRepository);
    useCase = new GetWorkflowDefinitionListUseCase(validator, workflowDefinitionRepository);
  }

  @Test
  @DisplayName("정상 조회 시 version 내 workflow 목록 반환")
  void execute_withValidQuery_returnsWorkflowList() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(
            workflowDefinitionRepository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
                VERSION_ID))
        .willReturn(List.of(createSummaryRow(1L, "refund_flow", "환불 플로우")));

    List<WorkflowDefinitionSummary> result =
        useCase.execute(
            new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID));

    assertThat(result).hasSize(1);
    assertThat(result.get(0).domainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(result.get(0).workflowCode()).isEqualTo("refund_flow");
    assertThat(result.get(0).name()).isEqualTo("환불 플로우");
  }

  @Test
  @DisplayName("workflow 없는 version → 빈 목록 반환")
  void execute_noWorkflows_returnsEmptyList() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(any(), any(), any())).willReturn(true);
    given(domainPackRepository.existsByIdAndWorkspaceId(PACK_ID, WORKSPACE_ID)).willReturn(true);
    given(domainPackVersionRepository.findById(VERSION_ID))
        .willReturn(Optional.of(createVersion(VERSION_ID, PACK_ID)));
    given(
            workflowDefinitionRepository.findAllByDomainPackVersionIdOrderByWorkflowCodeAsc(
                VERSION_ID))
        .willReturn(List.of());

    List<WorkflowDefinitionSummary> result =
        useCase.execute(
            new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID));

    assertThat(result).isEmpty();
  }

  @Test
  @DisplayName("workspace 없음 → DomainPackWorkspaceNotFoundException")
  void execute_workspaceNotFound_throwsException() {
    given(workspaceExistencePort.existsById(WORKSPACE_ID)).willReturn(false);

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID)))
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
                    new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID)))
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
                    new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID)))
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
                    new GetWorkflowDefinitionListQuery(WORKSPACE_ID, PACK_ID, VERSION_ID, USER_ID)))
        .isInstanceOf(DomainPackVersionNotFoundException.class);
  }

  private DomainPackVersion createVersion(Long id, Long packId) {
    return DomainPackVersion.ofForTest(id, packId, DomainPackVersion.STATUS_DRAFT);
  }

  private WorkflowDefinitionSummaryRow createSummaryRow(Long id, String code, String name) {
    return new WorkflowDefinitionSummaryRow() {
      @Override
      public Long getId() {
        return id;
      }

      @Override
      public Long getDomainPackVersionId() {
        return VERSION_ID;
      }

      @Override
      public String getWorkflowCode() {
        return code;
      }

      @Override
      public String getName() {
        return name;
      }

      @Override
      public String getDescription() {
        return null;
      }

      @Override
      public String getInitialState() {
        return "start";
      }

      @Override
      public String getTerminalStatesJson() {
        return "[\"terminal\"]";
      }

      @Override
      public OffsetDateTime getCreatedAt() {
        return OffsetDateTime.parse("2026-04-14T10:00:00Z");
      }

      @Override
      public OffsetDateTime getUpdatedAt() {
        return OffsetDateTime.parse("2026-04-14T10:00:00Z");
      }
    };
  }
}
