package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.application.DomainPackDraftSourceType;
import com.init.domainpack.application.DomainPackVersionCloneResult;
import com.init.domainpack.application.DomainPackVersionCloneService;
import com.init.domainpack.domain.model.DomainPackVersion;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.domain.InvalidStructuralPatchException;
import com.init.workflowruntime.domain.SimulationImprovementCandidate;
import com.init.workflowruntime.domain.SimulationImprovementCandidateDraft;
import com.init.workflowruntime.domain.SimulationImprovementCandidateTargetType;
import com.init.workflowruntime.domain.SimulationImprovementCandidateType;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchEvidence;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationImprovementDraftPatchService")
class SimulationImprovementDraftPatchServiceTest {

  private static final Long WORKSPACE_ID = 1L;
  private static final Long USER_ID = 2L;
  private static final Long VERSION_ID = 100L;
  private static final Long PACK_ID = 200L;
  private static final Long DRAFT_ID = 300L;
  private static final Long FEEDBACK_ID = 400L;
  private static final Long SESSION_ID = 500L;

  private static final String STRUCTURAL_JSON =
      "{\"schemaVersion\":\"simulation-structural-patch.v1\",\"summary\":\"s\","
          + "\"evidence\":{\"failureSummary\":\"f\"},"
          + "\"operations\":[{\"op\":\"UPDATE_INTENT_DESCRIPTION\",\"intentCode\":\"greet\","
          + "\"description\":\"d\",\"reason\":\"r\"}]}";

  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private DomainPackVersionCloneService cloneService;
  @Mock private IntentDefinitionRepository intentRepository;
  @Mock private SlotDefinitionRepository slotRepository;
  @Mock private PolicyDefinitionRepository policyRepository;
  @Mock private RiskDefinitionRepository riskRepository;
  @Mock private WorkflowDefinitionRepository workflowRepository;
  @Mock private StructuralDomainPackPatchParser structuralPatchParser;
  @Mock private SimulationStructuralPatchApplyService structuralPatchApplyService;

  private SimulationImprovementDraftPatchService service;

  @BeforeEach
  void setUp() {
    service =
        new SimulationImprovementDraftPatchService(
            domainPackVersionRepository,
            cloneService,
            intentRepository,
            slotRepository,
            policyRepository,
            riskRepository,
            workflowRepository,
            structuralPatchParser,
            structuralPatchApplyService,
            new ObjectMapper());
  }

  @Test
  @DisplayName("구조적 패치 schema면 structural apply로 위임하고 description 경로를 건드리지 않는다")
  void should_routeToStructuralApply_when_schemaMatches() {
    givenDraftSource();
    StructuralDomainPackPatch patch = structuralPatch();
    given(structuralPatchParser.parse(STRUCTURAL_JSON)).willReturn(patch);

    service.applyDraftPatch(
        WORKSPACE_ID,
        USER_ID,
        candidate(STRUCTURAL_JSON, SimulationImprovementCandidateTargetType.INTENT, "greet"));

    verify(structuralPatchParser).parse(STRUCTURAL_JSON);
    verify(structuralPatchApplyService).apply(VERSION_ID, patch);
    verify(cloneService, never()).cloneVersion(any());
    verifyNoInteractions(
        intentRepository, slotRepository, policyRepository, riskRepository, workflowRepository);
  }

  @Test
  @DisplayName("구조적 schema가 아니면 기존 description 패치 경로를 사용한다")
  void should_routeToLegacyDescription_when_notStructural() {
    givenDraftSource();
    IntentDefinition intent =
        IntentDefinition.create(VERSION_ID, "greet", "인사", "기존", 1, "{}", "{}", "[]", "{}");
    given(intentRepository.findByDomainPackVersionIdAndIntentCode(VERSION_ID, "greet"))
        .willReturn(Optional.of(intent));

    service.applyDraftPatch(
        WORKSPACE_ID,
        USER_ID,
        candidate("{}", SimulationImprovementCandidateTargetType.INTENT, "greet"));

    verify(intentRepository).save(intent);
    verifyNoInteractions(structuralPatchParser, structuralPatchApplyService);
  }

  @Test
  @DisplayName("source가 DRAFT가 아니면 draft를 clone한 뒤 적용한다")
  void should_cloneDraft_when_sourceNotDraft() {
    DomainPackVersion source = DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, "PUBLISHED");
    DomainPackVersion draft = DomainPackVersion.ofForTest(DRAFT_ID, PACK_ID, "DRAFT");
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(source));
    given(
            domainPackVersionRepository
                .findFirstByDomainPackIdAndLifecycleStatusOrderByVersionNoDesc(PACK_ID, "DRAFT"))
        .willReturn(Optional.empty());
    given(cloneService.cloneVersion(any()))
        .willReturn(
            new DomainPackVersionCloneResult(
                DRAFT_ID,
                2,
                "DRAFT",
                DomainPackDraftSourceType.SIMULATION_REVIEW,
                VERSION_ID,
                1,
                "r"));
    given(domainPackVersionRepository.findByIdForUpdate(DRAFT_ID)).willReturn(Optional.of(draft));
    StructuralDomainPackPatch patch = structuralPatch();
    given(structuralPatchParser.parse(STRUCTURAL_JSON)).willReturn(patch);

    service.applyDraftPatch(
        WORKSPACE_ID,
        USER_ID,
        candidate(STRUCTURAL_JSON, SimulationImprovementCandidateTargetType.INTENT, "greet"));

    verify(cloneService).cloneVersion(any());
    verify(structuralPatchApplyService).apply(DRAFT_ID, patch);
  }

  @Test
  @DisplayName("적용 실패는 호출자로 전파되어 트랜잭션이 롤백되도록 한다")
  void should_propagateException_when_applyFails() {
    givenDraftSource();
    given(structuralPatchParser.parse(STRUCTURAL_JSON)).willReturn(structuralPatch());
    willThrow(new InvalidStructuralPatchException("invalid"))
        .given(structuralPatchApplyService)
        .apply(eq(VERSION_ID), any());

    assertThatThrownBy(
            () ->
                service.applyDraftPatch(
                    WORKSPACE_ID,
                    USER_ID,
                    candidate(
                        STRUCTURAL_JSON, SimulationImprovementCandidateTargetType.INTENT, "greet")))
        .isInstanceOf(InvalidStructuralPatchException.class);
  }

  private void givenDraftSource() {
    DomainPackVersion source = DomainPackVersion.ofForTest(VERSION_ID, PACK_ID, "DRAFT");
    given(domainPackVersionRepository.findByIdForUpdate(VERSION_ID))
        .willReturn(Optional.of(source));
  }

  private StructuralDomainPackPatch structuralPatch() {
    return new StructuralDomainPackPatch(
        StructuralDomainPackPatch.SCHEMA_VERSION,
        "summary",
        new StructuralPatchEvidence(1L, 2L, null, null, "failure"),
        List.of(
            new StructuralPatchOperation.ElementAttribute(
                StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION,
                StructuralPatchOperationType.UPDATE_INTENT_DESCRIPTION.getCategory(),
                "greet",
                null,
                "d",
                "reason")));
  }

  private SimulationImprovementCandidate candidate(
      String draftPatchJson, SimulationImprovementCandidateTargetType targetType, String key) {
    SimulationImprovementCandidateDraft draft =
        new SimulationImprovementCandidateDraft(
            SimulationImprovementCandidateType.OTHER,
            targetType,
            null,
            key,
            "before",
            "새 설명",
            "evidence");
    SimulationImprovementCandidate candidate =
        SimulationImprovementCandidate.create(
            WORKSPACE_ID, VERSION_ID, FEEDBACK_ID, SESSION_ID, null, draft, USER_ID);
    candidate.defineDraftPatch(draftPatchJson);
    return candidate;
  }
}
