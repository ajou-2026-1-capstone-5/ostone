package com.init.workflowruntime.application;

import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.chatSessionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.intentDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.policyDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.reviewSessionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.reviewTaskWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.riskDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationCandidateWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationCandidateWithWorkspaceId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.simulationFeedbackWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.slotDefinitionWithId;
import static com.init.workflowruntime.support.WorkflowRuntimeTestObjects.workflowDefinitionWithId;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.DomainPackDraftSourceType;
import com.init.domainpack.application.DomainPackVersionCloneCommand;
import com.init.domainpack.application.DomainPackVersionCloneResult;
import com.init.domainpack.application.DomainPackVersionCloneService;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.PolicyDefinition;
import com.init.domainpack.domain.model.RiskDefinition;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.domain.model.WorkflowDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewDecisionRepository;
import com.init.review.domain.repository.ReviewSessionRepository;
import com.init.review.domain.repository.ReviewTaskRepository;
import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.command.ApproveSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.CreateSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.RejectSimulationImprovementCandidateCommand;
import com.init.workflowruntime.application.command.UpdateSimulationImprovementCandidateStatusCommand;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackContent;
import com.init.workflowruntime.domain.SimulationFeedbackRepository;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateDraft;
import com.init.workflowruntime.domain.SimulationImprovementCandidateRepository;
import com.init.workflowruntime.domain.SimulationImprovementCandidateStatus;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import com.init.workflowruntime.domain.SimulationPatchValidationStatus;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationImprovementCandidateService")
class SimulationImprovementCandidateServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long SESSION_ID = 55L;
  private static final Long FEEDBACK_ID = 900L;
  private static final OffsetDateTime REVIEWED_AT = OffsetDateTime.parse("2026-06-01T09:00:00Z");

  @Mock private SimulationFeedbackRepository feedbackRepository;
  @Mock private SimulationImprovementCandidateRepository candidateRepository;
  @Mock private ChatSessionRepository chatSessionRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackVersionCloneService domainPackVersionCloneService;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private ReviewSessionRepository reviewSessionRepository;
  @Mock private ReviewTaskRepository reviewTaskRepository;
  @Mock private ReviewDecisionRepository reviewDecisionRepository;
  @Mock private WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  @Mock private SimulationStructuralPatchGenerationService structuralPatchGenerationService;

  private SimulationImprovementCandidateService service;
  private SimulationImprovementDraftPatchService draftPatchService;
  private SimulationImprovementCandidateReviewTaskService reviewTaskService;
  private SimulationImprovementCandidateDecisionService decisionService;
  private ObjectMapper objectMapper;

  @BeforeEach
  void setUp() {
    objectMapper = new ObjectMapper();
    Clock clock = Clock.systemDefaultZone();
    reviewTaskService =
        new SimulationImprovementCandidateReviewTaskService(
            reviewSessionRepository,
            reviewTaskRepository,
            reviewDecisionRepository,
            objectMapper,
            clock);
    draftPatchService =
        new SimulationImprovementDraftPatchService(
            domainPackVersionRepository,
            domainPackVersionCloneService,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            new StructuralDomainPackPatchParser(objectMapper),
            org.mockito.Mockito.mock(SimulationStructuralPatchApplyService.class),
            objectMapper);
    decisionService =
        new SimulationImprovementCandidateDecisionService(
            candidateRepository,
            feedbackRepository,
            reviewTaskService,
            draftPatchService,
            profileBuildRequestService,
            clock);
    service = candidateService(false);
  }

  private SimulationImprovementCandidateService candidateService(boolean structuralPatchEnabled) {
    return new SimulationImprovementCandidateService(
        feedbackRepository,
        candidateRepository,
        chatSessionRepository,
        workspaceMemberRepository,
        reviewTaskService,
        decisionService,
        structuralPatchGenerationService,
        new SimulationCandidatePatchViewMapper(
            new StructuralDomainPackPatchParser(objectMapper), objectMapper),
        objectMapper,
        structuralPatchEnabled);
  }

  @Test
  @DisplayName("createFromFeedback: OPEN 피드백에서 후보를 만들고 feedback 상태를 변경한다")
  void shouldCreateCandidateFromOpenFeedback() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    SimulationImprovementCandidate saved = withCandidateId(candidate(feedback), 1000L);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class))).willReturn(saved);

    var result =
        service.createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                WORKSPACE_ID,
                USER_ID,
                FEEDBACK_ID,
                null,
                300L,
                "order_number",
                "주문번호 질문 없음",
                "주문번호 질문 추가"));

    ArgumentCaptor<SimulationImprovementCandidate> candidateCaptor =
        ArgumentCaptor.forClass(SimulationImprovementCandidate.class);
    verify(candidateRepository).save(candidateCaptor.capture());
    assertThat(candidateCaptor.getValue().getDomainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(candidateCaptor.getValue().getCandidateType())
        .isEqualTo(SimulationImprovementCandidateType.SLOT_QUESTION);
    assertThat(candidateCaptor.getValue().getTargetElementType())
        .isEqualTo(SimulationImprovementCandidateTargetType.SLOT);
    assertThat(candidateCaptor.getValue().getTargetElementId()).isEqualTo(300L);
    assertThat(candidateCaptor.getValue().getTargetElementKey()).isEqualTo("order_number");
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.CANDIDATE_CREATED);
    verify(feedbackRepository).save(feedback);
    assertThat(result.id()).isEqualTo(1000L);
  }

  @Test
  @DisplayName("createFromFeedback: 구조적 패치 생성이 켜지고 성공하면 검증된 패치를 draftPatchJson에 저장한다")
  void shouldStoreStructuralPatch_whenGenerationEnabledAndSucceeds() {
    SimulationImprovementCandidateService enabledService = candidateService(true);
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    String patchJson =
        "{\"schemaVersion\":\"simulation-structural-patch.v1\",\"summary\":\"슬롯 보강\","
            + "\"evidence\":{\"failureSummary\":\"missing slot\"},"
            + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"order_number\","
            + "\"reason\":\"필수\"}]}";
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(structuralPatchGenerationService.generate(any(), any()))
        .willReturn(SimulationStructuralPatchGenerationResult.success(patchJson));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    enabledService.createFromFeedback(
        new CreateSimulationImprovementCandidateCommand(
            WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, "order_number", null, null));

    ArgumentCaptor<SimulationImprovementCandidate> candidateCaptor =
        ArgumentCaptor.forClass(SimulationImprovementCandidate.class);
    verify(candidateRepository).save(candidateCaptor.capture());
    assertThat(candidateCaptor.getValue().getDraftPatchJson()).isEqualTo(patchJson);
  }

  @Test
  @DisplayName("createFromFeedback: 구조적 패치 생성이 실패하면 생성 실패 envelope를 draftPatchJson에 저장한다")
  void shouldStoreGenerationFailureEnvelope_whenGenerationFails() throws Exception {
    SimulationImprovementCandidateService enabledService = candidateService(true);
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(structuralPatchGenerationService.generate(any(), any()))
        .willReturn(
            SimulationStructuralPatchGenerationResult.invalidOutput("지원하지 않는 operation입니다: FOO"));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    enabledService.createFromFeedback(
        new CreateSimulationImprovementCandidateCommand(
            WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, "order_number", null, null));

    ArgumentCaptor<SimulationImprovementCandidate> candidateCaptor =
        ArgumentCaptor.forClass(SimulationImprovementCandidate.class);
    verify(candidateRepository).save(candidateCaptor.capture());
    JsonNode envelope = objectMapper.readTree(candidateCaptor.getValue().getDraftPatchJson());
    assertThat(envelope.get("schemaVersion").asText())
        .isEqualTo("simulation-structural-patch-generation.v1");
    assertThat(envelope.get("status").asText()).isEqualTo("INVALID_OUTPUT");
    assertThat(envelope.get("summary").asText()).isNotBlank();
    assertThat(envelope.get("message").asText()).contains("FOO");
    assertThat(envelope.get("descriptionPatch").get("schemaVersion").asText())
        .isEqualTo("simulation-candidate-draft-patch.v1");
  }

  @Test
  @DisplayName("createFromFeedback: 이미 후보가 있으면 새로 만들지 않고 기존 후보를 반환한다")
  void shouldReturnExistingCandidate_whenFeedbackAlreadyHasCandidate() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate existing = withCandidateId(candidate(feedback), 1000L);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.of(existing));

    var result =
        service.createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, null, null, null));

    assertThat(result.id()).isEqualTo(1000L);
    verifyNoInteractions(chatSessionRepository);
  }

  @Test
  @DisplayName("createFromFeedback: 후보가 없고 OPEN이 아닌 피드백은 거절한다")
  void shouldRejectNonOpenFeedback_whenNoCandidateExists() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.createFromFeedback(
                    new CreateSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, null, null, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("OPEN 피드백");
  }

  @Test
  @DisplayName("createFromFeedback: 요청 target type을 적용한다")
  void shouldUseRequestedTargetType() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    service.createFromFeedback(
        new CreateSimulationImprovementCandidateCommand(
            WORKSPACE_ID, USER_ID, FEEDBACK_ID, "risk_rule", null, null, null, null));

    ArgumentCaptor<SimulationImprovementCandidate> candidateCaptor =
        ArgumentCaptor.forClass(SimulationImprovementCandidate.class);
    verify(candidateRepository).save(candidateCaptor.capture());
    assertThat(candidateCaptor.getValue().getTargetElementType())
        .isEqualTo(SimulationImprovementCandidateTargetType.RISK_RULE);
  }

  @ParameterizedTest(name = "{0} -> {1}/{2}")
  @CsvSource({
    "INTENT_MISMATCH, INTENT_DESCRIPTION_EXAMPLE, INTENT",
    "POLICY_CONDITION_MISSING, POLICY_CONDITION, POLICY",
    "RISK_HANDOFF_REQUIRED, HANDOFF_CONDITION, HANDOFF",
    "WORKFLOW_BRANCH_ERROR, WORKFLOW_STATE_TRANSITION, WORKFLOW",
    "INAPPROPRIATE_RESPONSE, RESPONSE_COPY, RESPONSE"
  })
  @DisplayName("createFromFeedback: feedback type에서 후보 type과 target type을 추론한다")
  void shouldInferCandidateAndTargetTypesFromFeedbackType(
      SimulationFeedbackType feedbackType,
      SimulationImprovementCandidateType expectedCandidateType,
      SimulationImprovementCandidateTargetType expectedTargetType) {
    givenMembership();
    SimulationFeedback feedback = withFeedbackId(feedback(feedbackType), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    var result =
        service.createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, null, null, null));

    assertThat(result.candidateType()).isEqualTo(expectedCandidateType);
    assertThat(result.targetElementType()).isEqualTo(expectedTargetType);
  }

  @Test
  @DisplayName("createFromFeedback: 빈 target type은 feedback type 기반 target으로 처리한다")
  void shouldInferTargetTypeWhenRequestedTargetTypeBlank() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.INTENT_MISMATCH), FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    var result =
        service.createFromFeedback(
            new CreateSimulationImprovementCandidateCommand(
                WORKSPACE_ID, USER_ID, FEEDBACK_ID, " ", null, null, null, null));

    assertThat(result.targetElementType())
        .isEqualTo(SimulationImprovementCandidateTargetType.INTENT);
  }

  @Test
  @DisplayName("createFromFeedback: 긴 feedback 설명으로 만든 근거 요약은 후보 제한 길이를 넘지 않는다")
  void shouldLimitGeneratedEvidenceSummary() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(
            SimulationFeedback.create(
                WORKSPACE_ID,
                SESSION_ID,
                2L,
                new SimulationFeedbackContent(
                    SimulationFeedbackType.OTHER,
                    "a".repeat(2000),
                    "기대 행동",
                    SimulationFeedbackSeverity.HIGH),
                USER_ID),
            FEEDBACK_ID);
    ChatSession session = withSessionId(simulationSession(), SESSION_ID);
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(candidateRepository.findByFeedbackId(FEEDBACK_ID)).willReturn(Optional.empty());
    given(chatSessionRepository.findById(SESSION_ID)).willReturn(Optional.of(session));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> withCandidateId(invocation.getArgument(0), 1000L));

    service.createFromFeedback(
        new CreateSimulationImprovementCandidateCommand(
            WORKSPACE_ID, USER_ID, FEEDBACK_ID, null, null, null, null, null));

    ArgumentCaptor<SimulationImprovementCandidate> candidateCaptor =
        ArgumentCaptor.forClass(SimulationImprovementCandidate.class);
    verify(candidateRepository).save(candidateCaptor.capture());
    assertThat(candidateCaptor.getValue().getEvidenceSummary()).hasSize(2000);
  }

  @Test
  @DisplayName("listCandidates: status 필터로 workspace 후보를 페이지 조회한다")
  void shouldListCandidatesByStatus() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    given(candidateRepository.findByWorkspaceIdAndStatus(any(), any(), any()))
        .willReturn(new DomainPage<>(List.of(candidate), 0, 20, 1, 1));

    var result = service.listCandidates(WORKSPACE_ID, USER_ID, "DRAFT", 0, 20);

    assertThat(result.content()).hasSize(1);
    verify(candidateRepository)
        .findByWorkspaceIdAndStatus(
            eq(WORKSPACE_ID), eq(SimulationImprovementCandidateStatus.DRAFT), any());
  }

  @Test
  @DisplayName("listCandidates: status 필터 대문자 변환은 기본 Locale 영향을 받지 않는다")
  void shouldListCandidatesParseStatusWithRootLocale() {
    Locale previousLocale = Locale.getDefault();
    try {
      Locale.setDefault(Locale.forLanguageTag("tr-TR"));
      givenMembership();
      given(candidateRepository.findByWorkspaceIdAndStatus(any(), any(), any()))
          .willReturn(new DomainPage<>(List.of(), 0, 20, 0, 0));

      service.listCandidates(WORKSPACE_ID, USER_ID, "ready_for_review", 0, 20);

      verify(candidateRepository)
          .findByWorkspaceIdAndStatus(
              eq(WORKSPACE_ID), eq(SimulationImprovementCandidateStatus.READY_FOR_REVIEW), any());
    } finally {
      Locale.setDefault(previousLocale);
    }
  }

  @Test
  @DisplayName("listCandidates: status 필터가 없으면 workspace 전체 후보를 페이지 조회한다")
  void shouldListCandidatesWithoutStatus() {
    givenMembership();
    given(candidateRepository.findByWorkspaceId(any(), any()))
        .willReturn(new DomainPage<>(List.of(), 0, 20, 0, 0));

    service.listCandidates(WORKSPACE_ID, USER_ID, " ", 0, 20);

    verify(candidateRepository)
        .findByWorkspaceId(eq(WORKSPACE_ID), eq(new DomainPageRequest(0, 20)));
  }

  @Test
  @DisplayName("listCandidates: 잘못된 page와 size는 기본값으로 정규화한다")
  void shouldNormalizeInvalidPageAndSizeToDefaults() {
    givenMembership();
    given(candidateRepository.findByWorkspaceId(any(), any()))
        .willReturn(new DomainPage<>(List.of(), 0, 20, 0, 0));

    service.listCandidates(WORKSPACE_ID, USER_ID, "", -1, 0);

    verify(candidateRepository)
        .findByWorkspaceId(eq(WORKSPACE_ID), eq(new DomainPageRequest(0, 20)));
  }

  @Test
  @DisplayName("getCandidate: workspace 후보 상세를 반환한다")
  void shouldGetCandidate() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));

    var result = service.getCandidate(WORKSPACE_ID, USER_ID, 1000L);

    assertThat(result.id()).isEqualTo(1000L);
  }

  @Test
  @DisplayName("updateStatus: READY_FOR_REVIEW 전이 시 review task를 연결한다")
  void shouldUpdateStatus() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    ReviewSession session = reviewSession(2000L);
    ReviewTask task = reviewTask(session.getId(), candidate.getId(), 3000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(
            reviewSessionRepository
                .findFirstByWorkspaceIdAndDomainPackVersionIdAndReviewKindAndStatusOrderByOpenedAtDesc(
                    any(), any(), any(), any()))
        .willReturn(Optional.of(session));
    given(
            reviewTaskRepository.findFirstByReviewSessionIdAndTargetTypeAndTargetIdOrderByIdDesc(
                any(), any(), any()))
        .willReturn(Optional.empty());
    given(reviewTaskRepository.save(any(ReviewTask.class))).willReturn(task);
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.updateStatus(
            new UpdateSimulationImprovementCandidateStatusCommand(
                WORKSPACE_ID, USER_ID, 1000L, "READY_FOR_REVIEW"));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);
    assertThat(result.reviewSessionId()).isEqualTo(2000L);
    assertThat(result.reviewTaskId()).isEqualTo(3000L);
  }

  @Test
  @DisplayName("updateStatus: 열린 review session이 없으면 새 session과 task를 만든다")
  void shouldCreateReviewSessionWhenUpdateStatusHasNoOpenSession() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    ReviewSession session = reviewSession(2000L);
    ReviewTask task = reviewTask(session.getId(), candidate.getId(), 3000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(
            reviewSessionRepository
                .findFirstByWorkspaceIdAndDomainPackVersionIdAndReviewKindAndStatusOrderByOpenedAtDesc(
                    any(), any(), any(), any()))
        .willReturn(Optional.empty());
    given(reviewSessionRepository.save(any(ReviewSession.class))).willReturn(session);
    given(
            reviewTaskRepository.findFirstByReviewSessionIdAndTargetTypeAndTargetIdOrderByIdDesc(
                any(), any(), any()))
        .willReturn(Optional.empty());
    given(reviewTaskRepository.save(any(ReviewTask.class))).willReturn(task);
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.updateStatus(
            new UpdateSimulationImprovementCandidateStatusCommand(
                WORKSPACE_ID, USER_ID, 1000L, "READY_FOR_REVIEW"));

    assertThat(result.reviewSessionId()).isEqualTo(2000L);
    assertThat(result.reviewTaskId()).isEqualTo(3000L);
    verify(reviewSessionRepository).save(any(ReviewSession.class));
  }

  @Test
  @DisplayName("updateStatus: 이미 review task가 연결된 후보는 기존 task를 재사용한다")
  void shouldReuseExistingReviewTaskWhenUpdateStatusAlreadyLinked() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    candidate.submitForReview(2000L, 3000L);
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.updateStatus(
            new UpdateSimulationImprovementCandidateStatusCommand(
                WORKSPACE_ID, USER_ID, 1000L, "READY_FOR_REVIEW"));

    assertThat(result.reviewTaskId()).isEqualTo(3000L);
    verifyNoInteractions(reviewSessionRepository);
  }

  @Test
  @DisplayName("listCandidates: workspace 멤버가 아니면 후보 목록을 조회할 수 없다")
  void shouldRejectListWithoutMembership() {
    assertThatThrownBy(() -> service.listCandidates(WORKSPACE_ID, USER_ID, "DRAFT", 0, 20))
        .isInstanceOf(WorkspaceAccessDeniedException.class)
        .hasMessageContaining("워크스페이스에 접근 권한이 없습니다.");
  }

  @Test
  @DisplayName("updateStatus: 지원하지 않는 status는 거절한다")
  void shouldRejectInvalidStatus() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));

    assertThatThrownBy(
            () ->
                service.updateStatus(
                    new UpdateSimulationImprovementCandidateStatusCommand(
                        WORKSPACE_ID, USER_ID, 1000L, "WAITING")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("지원하지 않는 후보 상태입니다");
  }

  @Test
  @DisplayName("updateStatus: READY_FOR_REVIEW 외 상태 전이는 승인/반려 endpoint로 유도한다")
  void shouldRejectTerminalStatusFromUpdateStatus() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));

    assertThatThrownBy(
            () ->
                service.updateStatus(
                    new UpdateSimulationImprovementCandidateStatusCommand(
                        WORKSPACE_ID, USER_ID, 1000L, "APPLIED")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("READY_FOR_REVIEW 전이");
  }

  @Test
  @DisplayName("approve: READY 후보를 draft slot description에 반영하고 feedback을 RESOLVED로 변경한다")
  void shouldApproveReadyCandidateAndApplyDraftPatch() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate =
        withCandidateId(
            SimulationImprovementCandidate.create(
                WORKSPACE_ID,
                VERSION_ID,
                FEEDBACK_ID,
                SESSION_ID,
                2L,
                new SimulationImprovementCandidateDraft(
                    SimulationImprovementCandidateType.SLOT_QUESTION,
                    SimulationImprovementCandidateTargetType.SLOT,
                    null,
                    "order_number",
                    "주문번호를 묻지 않았습니다.",
                    "주문번호를 먼저 요청합니다.",
                    "simulation feedback #900"),
                USER_ID),
            1000L);
    candidate.submitForReview(2000L, 3000L);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            VERSION_ID, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);

    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(draftVersion));
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, "order_number"))
        .willReturn(Optional.of(slot));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(
                WORKSPACE_ID, USER_ID, 1000L, "반영합니다."));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.APPLIED);
    assertThat(result.appliedDomainPackVersionId()).isEqualTo(VERSION_ID);
    assertThat(slot.getDescription()).isEqualTo("주문번호를 먼저 요청합니다.");
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.RESOLVED);
    verify(reviewDecisionRepository).save(any());
    verify(profileBuildRequestService).enqueue(VERSION_ID, "SIMULATION_CANDIDATE_APPLIED");
  }

  @Test
  @DisplayName("approve: profile rebuild enqueue 실패 시 후보와 feedback을 terminal 상태로 저장하지 않는다")
  void shouldNotPersistApprovalStateWhenProfileEnqueueFails() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate =
        withCandidateId(
            SimulationImprovementCandidate.create(
                WORKSPACE_ID,
                VERSION_ID,
                FEEDBACK_ID,
                SESSION_ID,
                2L,
                new SimulationImprovementCandidateDraft(
                    SimulationImprovementCandidateType.SLOT_QUESTION,
                    SimulationImprovementCandidateTargetType.SLOT,
                    null,
                    "order_number",
                    "주문번호를 묻지 않았습니다.",
                    "주문번호를 먼저 요청합니다.",
                    "simulation feedback #900"),
                USER_ID),
            1000L);
    candidate.submitForReview(2000L, 3000L);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            VERSION_ID, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);

    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(draftVersion));
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, "order_number"))
        .willReturn(Optional.of(slot));
    willThrow(new IllegalStateException("profile enqueue failed"))
        .given(profileBuildRequestService)
        .enqueue(VERSION_ID, "SIMULATION_CANDIDATE_APPLIED");

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, "반영합니다.")))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("profile enqueue failed");

    assertThat(candidate.getStatus())
        .isEqualTo(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.CANDIDATE_CREATED);
    verify(candidateRepository, never()).save(any());
    verify(feedbackRepository, never()).save(any());
    verifyNoInteractions(reviewDecisionRepository);
  }

  @Test
  @DisplayName("approve: INTENT 후보를 draft intent description에 반영한다")
  void shouldApproveIntentCandidate() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.INTENT,
            null,
            "refund_intent",
            "환불 intent 설명을 보강합니다.");
    IntentDefinition intent =
        IntentDefinition.create(
            VERSION_ID, "refund_intent", "환불", "기존 설명", 1, "{}", "{}", "[]", "{}");
    givenApprovalBasics(candidate, DomainPackVersion.STATUS_DRAFT);
    given(
            intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(
                VERSION_ID, "refund_intent"))
        .willReturn(Optional.of(intent));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.APPLIED);
    assertThat(intent.getDescription()).isEqualTo("환불 intent 설명을 보강합니다.");
    verify(intentDefinitionRepository).save(intent);
  }

  @Test
  @DisplayName("approve: POLICY 후보를 draft policy description에 반영한다")
  void shouldApprovePolicyCandidate() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.POLICY,
            null,
            "refund_policy",
            "환불 정책 조건을 보강합니다.");
    PolicyDefinition policy =
        PolicyDefinition.create(
            VERSION_ID, "refund_policy", "환불 정책", "기존 설명", "HIGH", "{}", "{}", "[]", "{}");
    givenApprovalBasics(candidate, DomainPackVersion.STATUS_DRAFT);
    given(
            policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(
                VERSION_ID, "refund_policy"))
        .willReturn(Optional.of(policy));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    service.approve(
        new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(policy.getDescription()).isEqualTo("환불 정책 조건을 보강합니다.");
    verify(policyDefinitionRepository).save(policy);
  }

  @Test
  @DisplayName("approve: RISK_RULE 후보를 draft risk description에 반영한다")
  void shouldApproveRiskCandidate() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.RISK_RULE,
            null,
            "handoff_risk",
            "상담원 연결 위험 조건을 보강합니다.");
    RiskDefinition risk =
        RiskDefinition.create(
            VERSION_ID, "handoff_risk", "상담원 연결", "기존 설명", "HIGH", "{}", "{}", "[]", "{}");
    givenApprovalBasics(candidate, DomainPackVersion.STATUS_DRAFT);
    given(riskDefinitionRepository.findByDomainPackVersionIdAndRiskCode(VERSION_ID, "handoff_risk"))
        .willReturn(Optional.of(risk));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    service.approve(
        new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(risk.getDescription()).isEqualTo("상담원 연결 위험 조건을 보강합니다.");
    verify(riskDefinitionRepository).save(risk);
  }

  @Test
  @DisplayName("approve: WORKFLOW 후보를 draft workflow description에 반영한다")
  void shouldApproveWorkflowCandidate() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.WORKFLOW,
            null,
            "refund_workflow",
            "환불 workflow 분기를 보강합니다.");
    WorkflowDefinition workflow =
        WorkflowDefinition.create(
            VERSION_ID,
            "refund_workflow",
            "환불 워크플로우",
            "기존 설명",
            "{}",
            "start",
            "[]",
            "[]",
            "{}",
            1L,
            true,
            "{}");
    givenApprovalBasics(candidate, DomainPackVersion.STATUS_DRAFT);
    given(
            workflowDefinitionRepository.findByDomainPackVersionIdAndWorkflowCode(
                VERSION_ID, "refund_workflow"))
        .willReturn(Optional.of(workflow));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    service.approve(
        new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(workflow.getDescription()).isEqualTo("환불 workflow 분기를 보강합니다.");
    verify(workflowDefinitionRepository).save(workflow);
  }

  @ParameterizedTest(name = "{0}")
  @CsvSource({
    "INTENT, refund_intent",
    "SLOT, order_number",
    "POLICY, refund_policy",
    "RISK_RULE, handoff_risk",
    "RESPONSE, refund_response"
  })
  @DisplayName("approve: target key가 없으면 source id에서 code를 찾아 draft 요소에 반영한다")
  void shouldResolveDraftTargetBySourceId(
      SimulationImprovementCandidateTargetType targetType, String targetCode) {
    Long targetId = 501L;
    SimulationImprovementCandidate candidate =
        readyCandidate(targetType, targetId, null, "id 기반으로 설명을 보강합니다.");
    givenApprovalBasics(candidate, DomainPackVersion.STATUS_DRAFT);
    Object target = stubTargetBySourceId(targetType, targetId, targetCode);
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    service.approve(
        new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertTargetDescription(target, "id 기반으로 설명을 보강합니다.");
  }

  @Test
  @DisplayName("approve: published 버전에 draft가 없으면 simulation review draft를 생성해 반영한다")
  void shouldClonePublishedVersionWhenApproveHasNoDraft() {
    Long draftVersionId = 202L;
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.SLOT, null, "order_number", "주문번호 질문을 추가합니다.");
    DomainPackVersion sourceVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_PUBLISHED);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(draftVersionId, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            draftVersionId, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    givenApprovalBasics(candidate, sourceVersion);
    given(
            domainPackVersionRepository
                .findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(
                    50L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(Optional.empty());
    given(domainPackVersionCloneService.cloneVersion(any(DomainPackVersionCloneCommand.class)))
        .willReturn(
            new DomainPackVersionCloneResult(
                draftVersionId,
                2,
                DomainPackVersion.STATUS_DRAFT,
                DomainPackDraftSourceType.SIMULATION_REVIEW,
                VERSION_ID,
                1,
                "simulation improvement candidate #1000"));
    given(domainPackVersionRepository.findByIdForUpdate(draftVersionId))
        .willReturn(Optional.of(draftVersion));
    given(
            slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(
                draftVersionId, "order_number"))
        .willReturn(Optional.of(slot));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.appliedDomainPackVersionId()).isEqualTo(draftVersionId);
    assertThat(slot.getDescription()).isEqualTo("주문번호 질문을 추가합니다.");
    ArgumentCaptor<DomainPackVersionCloneCommand> cloneCommandCaptor =
        ArgumentCaptor.forClass(DomainPackVersionCloneCommand.class);
    verify(domainPackVersionCloneService).cloneVersion(cloneCommandCaptor.capture());
    assertThat(cloneCommandCaptor.getValue().sourceType())
        .isEqualTo(DomainPackDraftSourceType.SIMULATION_REVIEW);
  }

  @Test
  @DisplayName("approve: published 버전의 기존 draft를 잠가 반영한다")
  void shouldUseExistingDraftWhenApprovePublishedVersion() {
    Long draftVersionId = 202L;
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.SLOT, null, "order_number", "주문번호 질문을 보강합니다.");
    DomainPackVersion sourceVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_PUBLISHED);
    DomainPackVersion existingDraft =
        DomainPackVersion.ofForTest(draftVersionId, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            draftVersionId, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    givenApprovalBasics(candidate, sourceVersion);
    given(
            domainPackVersionRepository
                .findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(
                    50L, DomainPackVersion.STATUS_DRAFT))
        .willReturn(Optional.of(existingDraft));
    given(domainPackVersionRepository.findByIdForUpdate(draftVersionId))
        .willReturn(Optional.of(existingDraft));
    given(
            slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(
                draftVersionId, "order_number"))
        .willReturn(Optional.of(slot));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.appliedDomainPackVersionId()).isEqualTo(draftVersionId);
    verifyNoInteractions(domainPackVersionCloneService);
  }

  @Test
  @DisplayName("approve: 대상 타입이 UNKNOWN이면 반영할 수 없다")
  void shouldRejectApproveWhenTargetUnknown() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(draftVersion));

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("변경 대상 요소");
  }

  @Test
  @DisplayName("approve: draft 대상 요소를 찾지 못하면 후보와 feedback 상태를 변경하지 않는다")
  void shouldKeepCandidateAndFeedbackWhenApproveTargetMissing() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate =
        withCandidateId(
            SimulationImprovementCandidate.create(
                WORKSPACE_ID,
                VERSION_ID,
                FEEDBACK_ID,
                SESSION_ID,
                2L,
                new SimulationImprovementCandidateDraft(
                    SimulationImprovementCandidateType.SLOT_QUESTION,
                    SimulationImprovementCandidateTargetType.SLOT,
                    null,
                    "missing_slot",
                    "기존 설명",
                    "새 설명",
                    "simulation feedback #900"),
                USER_ID),
            1000L);
    candidate.submitForReview(2000L, 3000L);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);

    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(draftVersion));
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, "missing_slot"))
        .willReturn(Optional.empty());

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, "반영합니다.")))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("개선 후보를 반영할 draft 대상 요소를 찾을 수 없습니다");

    assertThat(candidate.getStatus())
        .isEqualTo(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.CANDIDATE_CREATED);
    verify(candidateRepository, never()).save(any());
    verify(feedbackRepository, never()).save(any());
    verifyNoInteractions(reviewDecisionRepository, profileBuildRequestService);
  }

  @Test
  @DisplayName("reject: READY 후보를 사유와 함께 REJECTED로 변경하고 feedback을 DISMISSED로 변경한다")
  void shouldRejectReadyCandidateWithReason() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.reject(
            new RejectSimulationImprovementCandidateCommand(
                WORKSPACE_ID, USER_ID, 1000L, "근거가 부족합니다."));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.REJECTED);
    assertThat(result.decisionReason()).isEqualTo("근거가 부족합니다.");
    assertThat(feedback.getStatus()).isEqualTo(SimulationFeedbackStatus.DISMISSED);
    verify(reviewDecisionRepository).save(any());
  }

  @Test
  @DisplayName("approve: READY가 아닌 후보는 승인할 수 없다")
  void shouldRejectApproveWhenCandidateNotReady() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("READY_FOR_REVIEW 후보");
  }

  @Test
  @DisplayName("approve: 이미 APPLIED 처리된 후보는 다시 승인할 수 없다")
  void shouldRejectApproveWhenCandidateAlreadyApplied() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    candidate.markApplied(VERSION_ID, USER_ID, "이미 반영됨", REVIEWED_AT);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("READY_FOR_REVIEW 후보");

    verifyNoInteractions(domainPackVersionRepository, profileBuildRequestService);
  }

  @Test
  @DisplayName("reject: review task가 연결되지 않은 READY 후보는 반려할 수 없다")
  void shouldRejectRejectWhenReviewTaskMissing() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.changeStatus(SimulationImprovementCandidateStatus.READY_FOR_REVIEW);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));

    assertThatThrownBy(
            () ->
                service.reject(
                    new RejectSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("review task가 없습니다");
  }

  @Test
  @DisplayName("reject: 이미 처리된 review task는 다시 반려할 수 없다")
  void shouldRejectRejectWhenReviewTaskResolved() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);
    task.resolve(USER_ID, REVIEWED_AT);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));

    assertThatThrownBy(
            () ->
                service.reject(
                    new RejectSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("이미 처리된 review task");
  }

  @Test
  @DisplayName("getCandidate: 다른 workspace 후보는 찾을 수 없는 후보로 처리한다")
  void shouldHideCandidateFromDifferentWorkspace() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    candidate = simulationCandidateWithWorkspaceId(candidate, 99L);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));

    assertThatThrownBy(() -> service.getCandidate(WORKSPACE_ID, USER_ID, 1000L))
        .isInstanceOf(NotFoundException.class)
        .hasMessageContaining("Simulation improvement candidate not found");
  }

  private void givenMembership() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(WORKSPACE_ID, USER_ID))
        .willReturn(
            Optional.of(WorkspaceMember.create(WORKSPACE_ID, USER_ID, WorkspaceMemberRole.OWNER)));
  }

  private SimulationFeedback feedback(SimulationFeedbackType type) {
    return SimulationFeedback.create(
        WORKSPACE_ID,
        SESSION_ID,
        2L,
        new SimulationFeedbackContent(
            type, "주문번호를 묻지 않았습니다.", "주문번호를 먼저 요청합니다.", SimulationFeedbackSeverity.HIGH),
        USER_ID);
  }

  private ChatSession simulationSession() {
    return ChatSession.create(
        WORKSPACE_ID,
        VERSION_ID,
        ChatSessionStatus.OPEN,
        SimulationService.SIMULATION_CHANNEL,
        "{\"simulation\":true}",
        USER_ID);
  }

  private SimulationImprovementCandidate candidate(SimulationFeedback feedback) {
    return SimulationImprovementCandidate.create(
        feedback.getWorkspaceId(),
        VERSION_ID,
        feedback.getId() != null ? feedback.getId() : FEEDBACK_ID,
        feedback.getChatSessionId(),
        feedback.getChatMessageId(),
        new SimulationImprovementCandidateDraft(
            SimulationImprovementCandidateType.OTHER,
            SimulationImprovementCandidateTargetType.UNKNOWN,
            null,
            null,
            feedback.getDescription(),
            feedback.getExpectedBehavior(),
            "simulation feedback #" + (feedback.getId() != null ? feedback.getId() : FEEDBACK_ID)),
        USER_ID);
  }

  private SimulationImprovementCandidate readyCandidate(
      SimulationImprovementCandidateTargetType targetType,
      Long targetId,
      String targetKey,
      String afterSummary) {
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate =
        withCandidateId(
            SimulationImprovementCandidate.create(
                WORKSPACE_ID,
                VERSION_ID,
                FEEDBACK_ID,
                SESSION_ID,
                2L,
                new SimulationImprovementCandidateDraft(
                    SimulationImprovementCandidateType.OTHER,
                    targetType,
                    targetId,
                    targetKey,
                    "기존 설명",
                    afterSummary,
                    "simulation feedback #900"),
                USER_ID),
            1000L);
    candidate.submitForReview(2000L, 3000L);
    return candidate;
  }

  private void givenApprovalBasics(
      SimulationImprovementCandidate candidate, String sourceVersionStatus) {
    givenApprovalBasics(
        candidate, DomainPackVersion.ofForTest(VERSION_ID, 50L, sourceVersionStatus));
  }

  private void givenApprovalBasics(
      SimulationImprovementCandidate candidate, DomainPackVersion sourceVersion) {
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.OTHER), FEEDBACK_ID);
    feedback.markCandidateCreated();
    ReviewTask task = reviewTask(2000L, candidate.getId(), 3000L);
    givenMembership();
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    given(feedbackRepository.findByIdForUpdate(FEEDBACK_ID)).willReturn(Optional.of(feedback));
    given(reviewTaskRepository.findById(3000L)).willReturn(Optional.of(task));
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(sourceVersion));
  }

  private Object stubTargetBySourceId(
      SimulationImprovementCandidateTargetType targetType, Long targetId, String targetCode) {
    return switch (targetType) {
      case INTENT -> {
        IntentDefinition intent =
            IntentDefinition.create(
                VERSION_ID, targetCode, "의도", "기존 설명", 1, "{}", "{}", "[]", "{}");
        intent = intentDefinitionWithId(intent, targetId);
        given(intentDefinitionRepository.findByIdAndDomainPackVersionId(targetId, VERSION_ID))
            .willReturn(Optional.of(intent));
        given(
                intentDefinitionRepository.findByDomainPackVersionIdAndIntentCode(
                    VERSION_ID, targetCode))
            .willReturn(Optional.of(intent));
        yield intent;
      }
      case SLOT -> {
        SlotDefinition slot =
            SlotDefinition.create(
                VERSION_ID, targetCode, "슬롯", "기존 설명", "STRING", false, "{}", null, "{}");
        slot = slotDefinitionWithId(slot, targetId);
        given(slotDefinitionRepository.findByIdAndDomainPackVersionId(targetId, VERSION_ID))
            .willReturn(Optional.of(slot));
        given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, targetCode))
            .willReturn(Optional.of(slot));
        yield slot;
      }
      case POLICY -> {
        PolicyDefinition policy =
            PolicyDefinition.create(
                VERSION_ID, targetCode, "정책", "기존 설명", "HIGH", "{}", "{}", "[]", "{}");
        policy = policyDefinitionWithId(policy, targetId);
        given(policyDefinitionRepository.findByIdAndDomainPackVersionId(targetId, VERSION_ID))
            .willReturn(Optional.of(policy));
        given(
                policyDefinitionRepository.findByDomainPackVersionIdAndPolicyCode(
                    VERSION_ID, targetCode))
            .willReturn(Optional.of(policy));
        yield policy;
      }
      case RISK_RULE -> {
        RiskDefinition risk =
            RiskDefinition.create(
                VERSION_ID, targetCode, "위험", "기존 설명", "HIGH", "{}", "{}", "[]", "{}");
        risk = riskDefinitionWithId(risk, targetId);
        given(riskDefinitionRepository.findByIdAndDomainPackVersionId(targetId, VERSION_ID))
            .willReturn(Optional.of(risk));
        given(riskDefinitionRepository.findByDomainPackVersionIdAndRiskCode(VERSION_ID, targetCode))
            .willReturn(Optional.of(risk));
        yield risk;
      }
      case RESPONSE -> {
        WorkflowDefinition workflow =
            WorkflowDefinition.create(
                VERSION_ID,
                targetCode,
                "응답 워크플로우",
                "기존 설명",
                "{}",
                "start",
                "[]",
                "[]",
                "{}",
                1L,
                true,
                "{}");
        workflow = workflowDefinitionWithId(workflow, targetId);
        given(workflowDefinitionRepository.findByIdAndDomainPackVersionId(targetId, VERSION_ID))
            .willReturn(Optional.of(workflow));
        given(
                workflowDefinitionRepository.findByDomainPackVersionIdAndWorkflowCode(
                    VERSION_ID, targetCode))
            .willReturn(Optional.of(workflow));
        yield workflow;
      }
      default -> throw new IllegalArgumentException("unsupported targetType: " + targetType);
    };
  }

  private void assertTargetDescription(Object target, String expectedDescription) {
    switch (target) {
      case IntentDefinition intent ->
          assertThat(intent.getDescription()).isEqualTo(expectedDescription);
      case SlotDefinition slot -> assertThat(slot.getDescription()).isEqualTo(expectedDescription);
      case PolicyDefinition policy ->
          assertThat(policy.getDescription()).isEqualTo(expectedDescription);
      case RiskDefinition risk -> assertThat(risk.getDescription()).isEqualTo(expectedDescription);
      case WorkflowDefinition workflow ->
          assertThat(workflow.getDescription()).isEqualTo(expectedDescription);
      default -> throw new IllegalArgumentException("unsupported target: " + target);
    }
  }

  private SimulationFeedback withFeedbackId(SimulationFeedback feedback, Long id) {
    return simulationFeedbackWithId(feedback, id);
  }

  private ChatSession withSessionId(ChatSession session, Long id) {
    return chatSessionWithId(session, id);
  }

  private SimulationImprovementCandidate withCandidateId(
      SimulationImprovementCandidate candidate, Long id) {
    return simulationCandidateWithId(candidate, id);
  }

  private ReviewSession reviewSession(Long id) {
    ReviewSession session =
        ReviewSession.createDomainPackReview(
            WORKSPACE_ID,
            VERSION_ID,
            ReviewSession.KIND_SIMULATION_IMPROVEMENT,
            "review",
            null,
            USER_ID,
            "{}",
            REVIEWED_AT);
    return reviewSessionWithId(session, id);
  }

  private ReviewTask reviewTask(Long sessionId, Long candidateId, Long id) {
    ReviewTask task =
        ReviewTask.create(
            sessionId,
            ReviewTask.TARGET_SIMULATION_IMPROVEMENT_CANDIDATE,
            candidateId,
            "{}",
            "task",
            "NORMAL",
            "{}",
            REVIEWED_AT);
    return reviewTaskWithId(task, id);
  }

  // ---- 정규화 필드 회귀 방지 ----

  @Test
  @DisplayName("getCandidate: VALID 패치 후보 조회 시 patchValidationStatus·operations·patchSummary가 채워진다")
  void getCandidate_returnsNormalizedPatchFields_whenPatchIsValid() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    candidate.defineDraftPatch(validStructuralPatchJson());
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));

    var result = service.getCandidate(WORKSPACE_ID, USER_ID, 1000L);

    assertThat(result.patchValidationStatus()).isEqualTo(SimulationPatchValidationStatus.VALID);
    assertThat(result.operations()).isNotEmpty();
    assertThat(result.patchSummary()).isEqualTo("슬롯 보강");
    assertThat(result.patchSchemaVersion()).isEqualTo("simulation-structural-patch.v1");
  }

  @Test
  @DisplayName("listCandidates: VALID 패치 후보 목록 조회 시 operations가 채워진다")
  void listCandidates_returnsNormalizedPatchFields_whenPatchIsValid() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    candidate.defineDraftPatch(validStructuralPatchJson());
    given(candidateRepository.findByWorkspaceId(any(), any()))
        .willReturn(new DomainPage<>(List.of(candidate), 0, 20, 1, 1));

    var result = service.listCandidates(WORKSPACE_ID, USER_ID, null, 0, 20);

    assertThat(result.content()).hasSize(1);
    var item = result.content().get(0);
    assertThat(item.patchValidationStatus()).isEqualTo(SimulationPatchValidationStatus.VALID);
    assertThat(item.operations()).isNotEmpty();
  }

  // ---- approve INVALID 가드 ----

  @Test
  @DisplayName(
      "approve: INVALID 패치(미상 schemaVersion) 후보를 승인하면 InvalidStructuralPatchException이 발생한다")
  void approve_throwsInvalidStructuralPatchException_whenPatchIsInvalid_unknownSchemaVersion() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    // generation failure envelope: 미상 schemaVersion → INVALID
    String invalidPatch =
        "{\"schemaVersion\":\"simulation-structural-patch-generation.v1\","
            + "\"status\":\"INVALID_OUTPUT\",\"summary\":\"생성 실패\"}";
    candidate.defineDraftPatch(invalidPatch);
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    // patchView.validationStatus == INVALID 확인 후 즉시 예외 → feedbackRepository 호출 없음

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, "반영합니다.")))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("INVALID 구조 패치");
  }

  @Test
  @DisplayName("approve: INVALID 패치(깨진 JSON) 후보를 승인하면 InvalidStructuralPatchException이 발생한다")
  void approve_throwsInvalidStructuralPatchException_whenPatchIsInvalid_malformedJson() {
    givenMembership();
    SimulationFeedback feedback =
        withFeedbackId(feedback(SimulationFeedbackType.MISSING_SLOT_QUESTION), FEEDBACK_ID);
    feedback.markCandidateCreated();
    SimulationImprovementCandidate candidate = withCandidateId(candidate(feedback), 1000L);
    candidate.submitForReview(2000L, 3000L);
    candidate.defineDraftPatch("{not valid json!!!");
    given(candidateRepository.findById(1000L)).willReturn(Optional.of(candidate));
    // patchView.validationStatus == INVALID 확인 후 즉시 예외 → feedbackRepository 호출 없음

    assertThatThrownBy(
            () ->
                service.approve(
                    new ApproveSimulationImprovementCandidateCommand(
                        WORKSPACE_ID, USER_ID, 1000L, null)))
        .isInstanceOf(InvalidStructuralPatchException.class)
        .hasMessageContaining("INVALID 구조 패치");
  }

  // ---- approve 정상: VALID/LEGACY/NONE 패치 ----

  @Test
  @DisplayName("approve: NONE 패치('{}')를 가진 후보는 정상 승인된다")
  void approve_succeedsForNonePatch() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.SLOT, null, "order_number", "주문번호 질문을 추가합니다.");
    // draftPatchJson 기본값 = "{}" → NONE
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            VERSION_ID, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    givenApprovalBasics(candidate, draftVersion);
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, "order_number"))
        .willReturn(Optional.of(slot));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.APPLIED);
    assertThat(result.patchValidationStatus()).isEqualTo(SimulationPatchValidationStatus.NONE);
  }

  @Test
  @DisplayName("approve: LEGACY 패치 후보는 정상 승인된다")
  void approve_succeedsForLegacyPatch() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.SLOT,
            null,
            "order_number",
            "주문번호 질문 설명을 보강합니다.");
    String legacyPatch =
        "{\"schemaVersion\":\"simulation-candidate-draft-patch.v1\","
            + "\"operation\":\"UPDATE_DESCRIPTION\"}";
    candidate.defineDraftPatch(legacyPatch);
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    SlotDefinition slot =
        SlotDefinition.create(
            VERSION_ID, "order_number", "주문번호", "기존 설명", "STRING", false, "{}", null, "{}");
    givenApprovalBasics(candidate, draftVersion);
    given(slotDefinitionRepository.findByDomainPackVersionIdAndSlotCode(VERSION_ID, "order_number"))
        .willReturn(Optional.of(slot));
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.APPLIED);
    assertThat(result.patchValidationStatus()).isEqualTo(SimulationPatchValidationStatus.LEGACY);
  }

  @Test
  @DisplayName("approve: VALID 패치 후보는 정상 승인되고 operations가 응답에 포함된다")
  void approve_succeedsForValidPatch_andIncludesOperationsInResponse() {
    SimulationImprovementCandidate candidate =
        readyCandidate(
            SimulationImprovementCandidateTargetType.SLOT, null, "order_number", "주문번호 질문을 추가합니다.");
    candidate.defineDraftPatch(validStructuralPatchJson());
    DomainPackVersion draftVersion =
        DomainPackVersion.ofForTest(VERSION_ID, 50L, DomainPackVersion.STATUS_DRAFT);
    // VALID 구조 패치는 structuralPatchApplyService(mock)로 처리되므로 slot 조회가 발생하지 않는다
    givenApprovalBasics(candidate, draftVersion);
    given(candidateRepository.save(any(SimulationImprovementCandidate.class)))
        .willAnswer(invocation -> invocation.getArgument(0));

    var result =
        service.approve(
            new ApproveSimulationImprovementCandidateCommand(WORKSPACE_ID, USER_ID, 1000L, null));

    assertThat(result.status()).isEqualTo(SimulationImprovementCandidateStatus.APPLIED);
    assertThat(result.patchValidationStatus()).isEqualTo(SimulationPatchValidationStatus.VALID);
    assertThat(result.operations()).isNotEmpty();
  }

  /** 서비스 테스트에서 재사용하는 유효한 simulation-structural-patch.v1 JSON fixture. */
  private static String validStructuralPatchJson() {
    return "{\"schemaVersion\":\"simulation-structural-patch.v1\",\"summary\":\"슬롯 보강\","
        + "\"evidence\":{\"failureSummary\":\"missing slot\"},"
        + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"order_number\","
        + "\"reason\":\"필수\"}]}";
  }
}
