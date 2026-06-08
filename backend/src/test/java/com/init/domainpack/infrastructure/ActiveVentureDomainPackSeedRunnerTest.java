package com.init.domainpack.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.init.domainpack.domain.repository.DomainPackCommandRepository;
import com.init.domainpack.domain.repository.DomainPackVersionRepository;
import com.init.domainpack.domain.repository.IntentDefinitionRepository;
import com.init.domainpack.domain.repository.IntentSlotBindingRepository;
import com.init.domainpack.domain.repository.PolicyDefinitionRepository;
import com.init.domainpack.domain.repository.RiskDefinitionRepository;
import com.init.domainpack.domain.repository.SlotDefinitionRepository;
import com.init.domainpack.domain.repository.WorkflowDefinitionRepository;
import com.init.workflowruntime.application.matching.WorkflowMatchingProfileBuildRequestService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

@ExtendWith(MockitoExtension.class)
@DisplayName("ActiveVentureDomainPackSeedRunner")
class ActiveVentureDomainPackSeedRunnerTest {

  private final ObjectMapper objectMapper = new ObjectMapper();

  @Mock private DomainPackCommandRepository domainPackRepository;
  @Mock private DomainPackVersionRepository domainPackVersionRepository;
  @Mock private IntentDefinitionRepository intentDefinitionRepository;
  @Mock private SlotDefinitionRepository slotDefinitionRepository;
  @Mock private PolicyDefinitionRepository policyDefinitionRepository;
  @Mock private RiskDefinitionRepository riskDefinitionRepository;
  @Mock private WorkflowDefinitionRepository workflowDefinitionRepository;
  @Mock private IntentSlotBindingRepository intentSlotBindingRepository;
  @Mock private WorkflowMatchingProfileBuildRequestService profileBuildRequestService;
  @Mock private EntityManager entityManager;
  @Mock private Query query;
  @Mock private Environment environment;

  private ActiveVentureDomainPackSeedRunner runner;

  @BeforeEach
  void setUp() {
    runner =
        new ActiveVentureDomainPackSeedRunner(
            domainPackRepository,
            domainPackVersionRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            intentSlotBindingRepository,
            profileBuildRequestService,
            entityManager,
            objectMapper,
            environment);
  }

  @Test
  @DisplayName("intent seed의 대표 사례와 route terms를 내부 리소스 JSON으로 보강한다")
  void shouldBuildIntentInternalResourceJsonFromSeedDraft() throws Exception {
    JsonNode draft = sampleIntentDraft();

    String sourceJson = runner.buildIntentSourceClusterRef(draft);
    String evidenceJson = runner.buildIntentEvidenceJson(draft);

    JsonNode source = objectMapper.readTree(sourceJson);
    assertThat(source.path("clusterId").asText()).isEqualTo("C10");
    assertThat(source.path("clusterSize").asInt()).isEqualTo(2);
    assertThat(source.path("canonicalIntent").asText()).isEqualTo("카드 분실 신고");
    assertThat(source.path("source").asText()).isEqualTo("manager_merge_plan");
    assertThat(source.path("segmentIds")).hasSize(2);
    assertThat(source.path("keywords")).extracting(JsonNode::asText).contains("분실", "정지", "재발급");

    JsonNode evidence = objectMapper.readTree(evidenceJson);
    assertThat(evidence.path("sampleSegmentTexts"))
        .extracting(JsonNode::asText)
        .contains("고객: 예, 제 카드 분실했는데 정지를 하고 싶거든요.");
    assertThat(evidence.path("sampleIntentPhrases"))
        .extracting(JsonNode::asText)
        .contains("도난/분실 신청/해제");
    assertThat(evidence.path("exemplarConversationIds"))
        .extracting(JsonNode::asText)
        .contains("200002");
    assertThat(evidence.path("representativeCases")).hasSize(2);
    assertThat(evidence.path("sourceRefs").path(0).path("value").asText()).isEqualTo("200002");
  }

  @Test
  @DisplayName("이미 publish된 seed pack도 intent 내부 리소스를 backfill한다")
  void shouldBackfillIntentInternalResourcesForExistingPublishedVersion() throws Exception {
    ArrayNode drafts = objectMapper.createArrayNode().add(sampleIntentDraft());
    given(entityManager.createNativeQuery(anyString())).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.executeUpdate()).willReturn(1);
    ArgumentCaptor<Object> evidenceCaptor = ArgumentCaptor.forClass(Object.class);

    int updatedCount = runner.backfillIntentInternalResources(18L, drafts);

    assertThat(updatedCount).isEqualTo(1);
    verify(query).setParameter(eq("versionId"), eq(18L));
    verify(query).setParameter(eq("intentCode"), eq("lost_card_report"));
    verify(query).setParameter(eq("evidenceJson"), evidenceCaptor.capture());
    JsonNode evidence = objectMapper.readTree((String) evidenceCaptor.getValue());
    assertThat(evidence.path("sampleSegmentTexts")).isNotEmpty();
    assertThat(evidence.path("representativeCases")).hasSize(2);
  }

  @Test
  @DisplayName("이미 publish된 seed pack의 slot 이름을 backfill한다")
  void shouldBackfillSlotNamesForExistingPublishedVersion() throws Exception {
    ArrayNode drafts = objectMapper.createArrayNode().add(sampleSlotDraft());
    given(entityManager.createNativeQuery(anyString())).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.executeUpdate()).willReturn(1);

    int updatedCount = runner.backfillSlotNames(18L, drafts);

    assertThat(updatedCount).isEqualTo(1);
    verify(query).setParameter(eq("versionId"), eq(18L));
    verify(query).setParameter(eq("slotCode"), eq("reservation_number"));
    verify(query).setParameter(eq("name"), eq("예약번호"));
  }

  @Test
  @DisplayName("이미 publish된 seed pack의 intent-slot prompt를 backfill한다")
  void shouldBackfillIntentSlotBindingPromptsForExistingPublishedVersion() throws Exception {
    ArrayNode drafts = objectMapper.createArrayNode().add(sampleIntentSlotBindingDraft());
    given(entityManager.createNativeQuery(anyString())).willReturn(query);
    given(query.setParameter(anyString(), any())).willReturn(query);
    given(query.executeUpdate()).willReturn(1);

    int updatedCount = runner.backfillIntentSlotBindingPrompts(18L, drafts);

    assertThat(updatedCount).isEqualTo(1);
    verify(query).setParameter(eq("versionId"), eq(18L));
    verify(query).setParameter(eq("intentCode"), eq("reservation_progress_and_documents"));
    verify(query).setParameter(eq("slotCode"), eq("reservation_number"));
    verify(query).setParameter(eq("promptHint"), eq("예약번호를 확인해 주세요."));
  }

  @Test
  @DisplayName("prod 프로파일이면 profile build enqueue를 비활성화한다")
  void shouldDisableProfileBuildEnqueueInProd() {
    given(environment.acceptsProfiles(any(Profiles.class))).willReturn(true);

    ActiveVentureDomainPackSeedRunner prodRunner =
        new ActiveVentureDomainPackSeedRunner(
            domainPackRepository,
            domainPackVersionRepository,
            intentDefinitionRepository,
            slotDefinitionRepository,
            policyDefinitionRepository,
            riskDefinitionRepository,
            workflowDefinitionRepository,
            intentSlotBindingRepository,
            profileBuildRequestService,
            entityManager,
            objectMapper,
            environment);

    assertThat(prodRunner.isProfileBuildEnqueueEnabled()).isFalse();
  }

  @Test
  @DisplayName("prod 가 아니면 profile build enqueue를 활성화한다")
  void shouldEnableProfileBuildEnqueueWhenNotProd() {
    assertThat(runner.isProfileBuildEnqueueEnabled()).isTrue();
  }

  private JsonNode sampleIntentDraft() throws Exception {
    return objectMapper.readTree(
        """
        {
          "intentCode": "lost_card_report",
          "name": "카드 분실 신고",
          "sourceClusterRef": "{\\"clusterId\\":\\"C10\\",\\"support\\":2,\\"memberSourceIds\\":[\\"200002\\",\\"200005\\"]}",
          "entryConditionJson": "{\\"requiredTerms\\":[\\"분실\\",\\"정지\\"],\\"optionalTerms\\":[\\"재발급\\"]}",
          "evidenceJson": "[{\\"type\\":\\"source_id\\",\\"value\\":\\"200002\\"}]",
          "metaJson": "{\\"source\\":\\"manager_merge_plan\\"}",
          "representativeCases": [
            {
              "conversationId": "200002",
              "canonicalText": "예, 제 카드 분실했는데 정지를 하고 싶거든요.",
              "customerProblemText": "도난/분실 신청/해제",
              "endedStatus": "resolved"
            },
            {
              "conversationId": "200005",
              "canonicalText": "외국에서 카드를 잊어버렸거든요.",
              "customerProblemText": "도난/분실 신청/해제",
              "endedStatus": "resolved"
            }
          ]
        }
        """);
  }

  private JsonNode sampleSlotDraft() throws Exception {
    return objectMapper.readTree(
        """
        {
          "slotCode": "reservation_number",
          "name": "예약번호"
        }
        """);
  }

  private JsonNode sampleIntentSlotBindingDraft() throws Exception {
    return objectMapper.readTree(
        """
        {
          "intentCode": "reservation_progress_and_documents",
          "slotCode": "reservation_number",
          "promptHint": "예약번호를 확인해 주세요."
        }
        """);
  }
}
