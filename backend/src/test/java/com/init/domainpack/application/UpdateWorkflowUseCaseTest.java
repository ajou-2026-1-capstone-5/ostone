package com.init.domainpack.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.domainpack.application.exception.WorkflowCycleDetectedException;
import com.init.domainpack.application.exception.WorkflowDanglingEdgeException;
import com.init.domainpack.application.exception.WorkflowInvalidStartNodeException;
import com.init.domainpack.application.exception.WorkflowInvalidTerminalNodeException;
import com.init.domainpack.application.exception.WorkflowUnlabeledBranchException;
import com.init.domainpack.application.exception.WorkflowUnreachableNodeException;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("UpdateWorkflowUseCase")
class UpdateWorkflowUseCaseTest {

  private static final String VALID_GRAPH =
      "{\"direction\":\"LR\","
          + "\"nodes\":[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
          + "\"edges\":[{\"from\":\"start\",\"to\":\"end\",\"label\":null}]}";

  @Mock private DomainPackValidator validator;
  @Mock private DomainPackVersionRepository versionRepository;
  @Mock private WorkflowDefinitionRepository workflowRepository;

  private UpdateWorkflowUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new UpdateWorkflowUseCase(validator, versionRepository, workflowRepository);
  }

  @Test
  @DisplayName("유효한 요청 시 workflow 수정 후 WorkflowDefinitionDetail 반환")
  void should_수정완료_when_유효한요청() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    given(workflowRepository.save(any())).willReturn(workflow);

    UpdateWorkflowCommand command =
        new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "수정된 이름", "새 설명", VALID_GRAPH);

    // when
    WorkflowDefinitionDetail result = useCase.execute(command);

    // then
    assertThat(result.name()).isEqualTo("수정된 이름");
    assertThat(result.description()).isEqualTo("새 설명");
    assertThat(result.initialState()).isEqualTo("start");
    verify(workflowRepository).save(workflow);
  }

  @Test
  @DisplayName("버전 미존재 시 NotFoundException")
  void should_버전없음예외_when_버전미존재() {
    given(versionRepository.findById(10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, VALID_GRAPH)))
        .isInstanceOf(NotFoundException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("packId 불일치 시 NotFoundException")
  void should_버전없음예외_when_packId불일치() {
    DomainPackVersion version = draftVersion(10L, 999L); // packId=999, not 7
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, VALID_GRAPH)))
        .isInstanceOf(NotFoundException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("DRAFT가 아닌 버전 수정 시 BadRequestException(WORKFLOW_NOT_EDITABLE)")
  void should_WORKFLOW_NOT_EDITABLE_when_버전이PUBLISHED() {
    DomainPackVersion version = publishedVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, VALID_GRAPH)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("DRAFT");

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("graphJson 크기 초과 시 BadRequestException(GRAPH_JSON_TOO_LARGE)")
  void should_GRAPH_JSON_TOO_LARGE_when_크기초과() {
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));

    String oversizedGraph = "x".repeat(100_001);
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, oversizedGraph)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("허용 크기");

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("존재하지 않는 workflowId 요청 시 NotFoundException")
  void should_404_when_workflowNotFound() {
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, VALID_GRAPH)))
        .isInstanceOf(NotFoundException.class);

    verify(workflowRepository, never()).save(any());
  }

  @Test
  @DisplayName("V1 위반(START 노드 != 1) 시 WorkflowInvalidStartNodeException")
  void should_V1예외_when_START노드이상() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    String noStartGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":[{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, noStartGraph)))
        .isInstanceOf(WorkflowInvalidStartNodeException.class);
  }

  @Test
  @DisplayName("V2 위반(TERMINAL 노드 없음) 시 WorkflowInvalidTerminalNodeException")
  void should_V2예외_when_TERMINAL노드없음() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    String noTerminalGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"type\":\"START\"},"
            + "{\"id\":\"n1\",\"type\":\"ACTION\"}],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"n1\",\"label\":null}]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, noTerminalGraph)))
        .isInstanceOf(WorkflowInvalidTerminalNodeException.class);
  }

  @Test
  @DisplayName("V3 위반(dangling edge) 시 WorkflowDanglingEdgeException")
  void should_V3예외_when_dangling엣지() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    String danglingGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"type\":\"START\"},"
            + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"nonexistent\",\"label\":null}]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, danglingGraph)))
        .isInstanceOf(WorkflowDanglingEdgeException.class);
  }

  @Test
  @DisplayName("V4 위반(미도달 노드) 시 WorkflowUnreachableNodeException")
  void should_V4예외_when_미도달노드() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    String unreachableGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"type\":\"START\"},"
            + "{\"id\":\"orphan\",\"type\":\"ACTION\"},"
            + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"end\",\"label\":null}]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, unreachableGraph)))
        .isInstanceOf(WorkflowUnreachableNodeException.class);
  }

  @Test
  @DisplayName("V5 위반(사이클) 시 WorkflowCycleDetectedException")
  void should_V5예외_when_사이클() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    // n1 → start creates a back-edge (cycle)
    String cycleGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"type\":\"START\"},"
            + "{\"id\":\"n1\",\"type\":\"ACTION\"},"
            + "{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":["
            + "{\"from\":\"start\",\"to\":\"n1\",\"label\":null},"
            + "{\"from\":\"n1\",\"to\":\"start\",\"label\":null},"
            + "{\"from\":\"n1\",\"to\":\"end\",\"label\":null}]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(1L, 7L, 10L, 99L, 5L, "이름", null, cycleGraph)))
        .isInstanceOf(WorkflowCycleDetectedException.class);
  }

  @Test
  @DisplayName("V6 위반(DECISION label 없음) 시 WorkflowUnlabeledBranchException")
  void should_V6예외_when_DECISION레이블없음() {
    // given
    DomainPackVersion version = draftVersion(10L, 7L);
    given(versionRepository.findById(10L)).willReturn(Optional.of(version));
    WorkflowDefinition workflow = workflow(99L, 10L);
    given(workflowRepository.findByIdAndDomainPackVersionId(99L, 10L))
        .willReturn(Optional.of(workflow));
    // d1 DECISION node has one unlabeled outgoing edge
    String unlabeledDecisionGraph =
        "{\"direction\":\"LR\","
            + "\"nodes\":["
            + "{\"id\":\"start\",\"type\":\"START\"},"
            + "{\"id\":\"d1\",\"type\":\"DECISION\"},"
            + "{\"id\":\"end1\",\"type\":\"TERMINAL\"},"
            + "{\"id\":\"end2\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":["
            + "{\"from\":\"start\",\"to\":\"d1\",\"label\":null},"
            + "{\"from\":\"d1\",\"to\":\"end1\",\"label\":\"yes\"},"
            + "{\"from\":\"d1\",\"to\":\"end2\",\"label\":null}]}";

    // when & then
    assertThatThrownBy(
            () ->
                useCase.execute(
                    new UpdateWorkflowCommand(
                        1L, 7L, 10L, 99L, 5L, "이름", null, unlabeledDecisionGraph)))
        .isInstanceOf(WorkflowUnlabeledBranchException.class);
  }

  // ── factories ──────────────────────────────────────────────────────────────

  private DomainPackVersion draftVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_DRAFT);
  }

  private DomainPackVersion publishedVersion(Long id, Long domainPackId) {
    return DomainPackVersion.ofForTest(id, domainPackId, DomainPackVersion.STATUS_PUBLISHED);
  }

  private WorkflowDefinition workflow(Long id, Long versionId) {
    String graph =
        "{\"direction\":\"LR\","
            + "\"nodes\":[{\"id\":\"start\",\"type\":\"START\"},{\"id\":\"end\",\"type\":\"TERMINAL\"}],"
            + "\"edges\":[{\"from\":\"start\",\"to\":\"end\",\"label\":null}]}";
    WorkflowDefinition wf =
        WorkflowDefinition.create(
            versionId, "wf_refund", "환불 플로우", null, graph, "start", "[\"end\"]", "[]", "{}");
    ReflectionTestUtils.setField(wf, "id", id);
    return wf;
  }
}
