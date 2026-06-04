package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.DomainPackVersionCloneService;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.SlotDefinition;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationImprovementCandidateService")
class SimulationImprovementCandidateServiceTest {

  private static final Long WORKSPACE_ID = 10L;
  private static final Long USER_ID = 7L;
  private static final Long VERSION_ID = 101L;
  private static final Long SESSION_ID = 55L;
  private static final Long FEEDBACK_ID = 900L;

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

  private SimulationImprovementCandidateService service;

  @BeforeEach
  void setUp() {
    service =
        new SimulationImprovementCandidateService(
            feedbackRepository,
            candidateRepository,
            chatSessionRepository,
            workspaceMemberRepository,
            domainPackVersionRepository,
            domainPackVersionCloneService,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            reviewSessionRepository,
            reviewTaskRepository,
            reviewDecisionRepository,
            profileBuildRequestService,
            new ObjectMapper(),
            Clock.systemDefaultZone());
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
  @DisplayName("getCandidate: 다른 workspace 후보는 찾을 수 없는 후보로 처리한다")
  void shouldHideCandidateFromDifferentWorkspace() {
    givenMembership();
    SimulationImprovementCandidate candidate =
        withCandidateId(candidate(feedback(SimulationFeedbackType.OTHER)), 1000L);
    ReflectionTestUtils.setField(candidate, "workspaceId", 99L);
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

  private SimulationFeedback withFeedbackId(SimulationFeedback feedback, Long id) {
    ReflectionTestUtils.setField(feedback, "id", id);
    return feedback;
  }

  private ChatSession withSessionId(ChatSession session, Long id) {
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }

  private SimulationImprovementCandidate withCandidateId(
      SimulationImprovementCandidate candidate, Long id) {
    ReflectionTestUtils.setField(candidate, "id", id);
    return candidate;
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
            OffsetDateTime.now());
    ReflectionTestUtils.setField(session, "id", id);
    return session;
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
            OffsetDateTime.now());
    ReflectionTestUtils.setField(task, "id", id);
    return task;
  }
}
