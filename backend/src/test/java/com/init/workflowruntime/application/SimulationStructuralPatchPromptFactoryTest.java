package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.DomainPackContext;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.Feedback;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.SessionMeta;
import com.init.workflowruntime.application.dto.SimulationImprovementEvidence.Turn;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("SimulationStructuralPatchPromptFactory")
class SimulationStructuralPatchPromptFactoryTest {

  private final SimulationStructuralPatchPromptFactory factory =
      new SimulationStructuralPatchPromptFactory(new ObjectMapper());

  private SimulationImprovementEvidence evidence() {
    return new SimulationImprovementEvidence(
        new Feedback(901L, "MISSING_SLOT_QUESTION", "픽업 날짜를 묻지 않았습니다.", "픽업 날짜를 먼저 묻기", "HIGH", 5L),
        new SessionMeta(
            42L,
            "RUNNING",
            "ask_intent",
            "pickup",
            "airport_pickup_reservation_flow",
            NullNode.getInstance(),
            List.of(new Turn("USER", "공항 픽업 예약하고 싶어요"))),
        null,
        new DomainPackContext(101L, List.of(), List.of(), List.of(), List.of(), List.of()));
  }

  @Test
  @DisplayName("user 프롬프트에 출력 계약·허용 operation·모호 탈출구가 포함된다")
  void shouldIncludeContractAndOperations() {
    String prompt = factory.buildUserPrompt(evidence());

    assertThat(prompt).contains("simulation-structural-patch.v1");
    assertThat(prompt).contains("MARK_SLOT_REQUIRED");
    assertThat(prompt).contains("ADD_WORKFLOW_NODE");
    assertThat(prompt).contains("NEEDS_HUMAN_TARGET");
  }

  @Test
  @DisplayName("user 프롬프트에 백엔드가 조립한 evidence 핵심 필드가 직렬화되어 들어간다")
  void shouldEmbedSerializedEvidence() {
    String prompt = factory.buildUserPrompt(evidence());

    assertThat(prompt).contains("픽업 날짜를 묻지 않았습니다.");
    assertThat(prompt).contains("airport_pickup_reservation_flow");
  }

  @Test
  @DisplayName("system 프롬프트는 JSON only 생성 역할을 고정한다")
  void shouldFixSystemRole() {
    assertThat(factory.systemPrompt()).contains("JSON only");
  }
}
