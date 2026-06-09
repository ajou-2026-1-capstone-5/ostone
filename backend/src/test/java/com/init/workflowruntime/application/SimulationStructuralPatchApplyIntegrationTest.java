package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.init.domainpack.domain.model.IntentDefinition;
import com.init.domainpack.domain.model.IntentSlotBinding;
import com.init.domainpack.domain.model.SlotDefinition;
import com.init.domainpack.infrastructure.persistence.JpaIntentDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaIntentSlotBindingRepository;
import com.init.domainpack.infrastructure.persistence.JpaPolicyDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaRiskDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaSlotDefinitionRepository;
import com.init.domainpack.infrastructure.persistence.JpaWorkflowDefinitionRepository;
import com.init.workflowruntime.domain.StructuralDomainPackPatch;
import com.init.workflowruntime.domain.StructuralPatchEvidence;
import com.init.workflowruntime.domain.StructuralPatchOperation;
import com.init.workflowruntime.domain.StructuralPatchOperationType;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

/**
 * 구조적 패치 적용이 실제 영속 상태에 반영되는지 검증한다. graphJson(jsonb) 내용 round-trip은 운영 PostgreSQL 매핑(기존 description
 * patch 경로에서 검증됨)과 {@code SimulationStructuralPatchApplyServiceTest}(실제 validator 사용)가 다루고, 여기서는
 * H2가 안정적으로 round-trip하는 컬럼(IntentSlotBinding.is_required)과 신규 조회 쿼리를 다룬다.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@TestPropertySource(
    properties = {
      "spring.datasource.url=jdbc:h2:mem:testdb-structural-patch;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
      "spring.datasource.driver-class-name=org.h2.Driver",
      "spring.datasource.username=sa",
      "spring.datasource.password=",
      "spring.jpa.hibernate.ddl-auto=create-drop",
      "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
      "spring.jpa.properties.hibernate.hbm2ddl.create_namespaces=true",
      "spring.liquibase.enabled=false"
    })
@DisplayName("SimulationStructuralPatchApply 영속 통합")
class SimulationStructuralPatchApplyIntegrationTest {

  private static final Long DRAFT_VERSION_ID = 9001L;

  @Autowired private TestEntityManager em;
  @Autowired private JpaIntentDefinitionRepository intentRepository;
  @Autowired private JpaSlotDefinitionRepository slotRepository;
  @Autowired private JpaPolicyDefinitionRepository policyRepository;
  @Autowired private JpaRiskDefinitionRepository riskRepository;
  @Autowired private JpaWorkflowDefinitionRepository workflowRepository;
  @Autowired private JpaIntentSlotBindingRepository intentSlotBindingRepository;

  private final ObjectMapper objectMapper = new ObjectMapper();
  private SimulationStructuralPatchApplyService service;
  private Long slotId;

  @BeforeEach
  void setUp() {
    service =
        new SimulationStructuralPatchApplyService(
            intentRepository,
            slotRepository,
            policyRepository,
            riskRepository,
            workflowRepository,
            intentSlotBindingRepository,
            new WorkflowGraphPatchApplier(objectMapper),
            objectMapper);

    IntentDefinition intent =
        em.persistAndFlush(
            IntentDefinition.create(
                DRAFT_VERSION_ID, "cancel", "취소", "취소 의도", 1, "{}", "{}", "[]", "{}"));
    SlotDefinition slot =
        em.persistAndFlush(
            SlotDefinition.create(
                DRAFT_VERSION_ID, "pickupDate", "픽업 일자", "설명", "STRING", false, "{}", null, "{}"));
    slotId = slot.getId();
    em.persistAndFlush(IntentSlotBinding.create(intent.getId(), slotId, false, 1, null, "{}"));
    em.clear();
  }

  @Test
  @DisplayName("MARK_SLOT_REQUIRED은 draft slot의 binding is_required를 영구히 true로 만든다")
  void should_persistSlotRequired() {
    service.apply(
        DRAFT_VERSION_ID,
        new StructuralDomainPackPatch(
            StructuralDomainPackPatch.SCHEMA_VERSION,
            "summary",
            new StructuralPatchEvidence(1L, 2L, null, null, "failure"),
            List.of(
                new StructuralPatchOperation.ElementAttribute(
                    StructuralPatchOperationType.MARK_SLOT_REQUIRED,
                    StructuralPatchOperationType.MARK_SLOT_REQUIRED.getCategory(),
                    "pickupDate",
                    null,
                    null,
                    "reason"))));
    em.flush();
    em.clear();

    List<IntentSlotBinding> bindings =
        intentSlotBindingRepository.findAllBySlotDefinitionId(slotId);
    assertThat(bindings).isNotEmpty();
    assertThat(bindings).allMatch(IntentSlotBinding::getIsRequired);
  }
}
