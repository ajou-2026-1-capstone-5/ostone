package com.init.workflowruntime.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("SimulationStructuralPatchGenerationService.interpret")
class SimulationStructuralPatchGenerationServiceTest {

  private final ObjectMapper objectMapper = new ObjectMapper();
  private final SimulationStructuralPatchGenerationService service =
      new SimulationStructuralPatchGenerationService(
          null, null, null, new StructuralDomainPackPatchParser(objectMapper), objectMapper);

  private static final String VALID_PATCH =
      "{\"schemaVersion\":\"simulation-structural-patch.v1\",\"summary\":\"슬롯 보강\","
          + "\"evidence\":{\"feedbackId\":901,\"failureSummary\":\"missing slot\"},"
          + "\"operations\":[{\"op\":\"MARK_SLOT_REQUIRED\",\"slotCode\":\"pickupDate\","
          + "\"reason\":\"예약 전 필수\"}]}";

  @Test
  @DisplayName("유효한 구조적 패치 출력은 SUCCESS로 검증된 JSON을 보관한다")
  void shouldReturnSuccess_whenOutputIsValidStructuralPatch() {
    SimulationStructuralPatchGenerationResult result = service.interpret(VALID_PATCH);

    assertThat(result.status()).isEqualTo(SimulationStructuralPatchGenerationStatus.SUCCESS);
    assertThat(result.isSuccess()).isTrue();
    assertThat(result.patchJson()).isEqualTo(VALID_PATCH);
  }

  @Test
  @DisplayName("코드펜스와 산문에 감싸여 와도 JSON 객체를 추출해 검증한다")
  void shouldExtractJson_whenWrappedInCodeFence() {
    String wrapped = "다음 패치입니다:\n```json\n" + VALID_PATCH + "\n```\n끝.";

    SimulationStructuralPatchGenerationResult result = service.interpret(wrapped);

    assertThat(result.isSuccess()).isTrue();
  }

  @Test
  @DisplayName("JSON 객체가 없는 응답은 INVALID_OUTPUT으로 처리한다")
  void shouldReturnInvalidOutput_whenNoJsonObject() {
    SimulationStructuralPatchGenerationResult result = service.interpret("죄송하지만 만들 수 없습니다");

    assertThat(result.status()).isEqualTo(SimulationStructuralPatchGenerationStatus.INVALID_OUTPUT);
    assertThat(result.patchJson()).isNull();
    assertThat(result.summary()).isNotBlank();
  }

  @Test
  @DisplayName("깨진 JSON은 INVALID_OUTPUT으로 처리한다")
  void shouldReturnInvalidOutput_whenJsonIsMalformed() {
    SimulationStructuralPatchGenerationResult result =
        service.interpret("{\"schemaVersion\": \"simulation-structural-patch.v1\",");

    assertThat(result.status()).isEqualTo(SimulationStructuralPatchGenerationStatus.INVALID_OUTPUT);
  }

  @Test
  @DisplayName("미지원 operation은 fail-closed로 INVALID_OUTPUT 처리한다")
  void shouldReturnInvalidOutput_whenOperationUnsupported() {
    String unsupported =
        "{\"schemaVersion\":\"simulation-structural-patch.v1\",\"summary\":\"x\","
            + "\"evidence\":{\"failureSummary\":\"f\"},"
            + "\"operations\":[{\"op\":\"DELETE_EVERYTHING\",\"reason\":\"r\"}]}";

    SimulationStructuralPatchGenerationResult result = service.interpret(unsupported);

    assertThat(result.status()).isEqualTo(SimulationStructuralPatchGenerationStatus.INVALID_OUTPUT);
    assertThat(result.message()).contains("DELETE_EVERYTHING");
  }

  @Test
  @DisplayName("모델이 NEEDS_HUMAN_TARGET을 반환하면 모호 대상 상태로 처리한다")
  void shouldReturnNeedsHumanTarget_whenModelDeclines() {
    String declined = "{\"status\":\"NEEDS_HUMAN_TARGET\",\"summary\":\"대상이 모호합니다\"}";

    SimulationStructuralPatchGenerationResult result = service.interpret(declined);

    assertThat(result.status())
        .isEqualTo(SimulationStructuralPatchGenerationStatus.NEEDS_HUMAN_TARGET);
    assertThat(result.summary()).isEqualTo("대상이 모호합니다");
    assertThat(result.patchJson()).isNull();
  }

  @Test
  @DisplayName("빈 응답은 INVALID_OUTPUT으로 처리한다")
  void shouldReturnInvalidOutput_whenBlank() {
    assertThat(service.interpret("  ").status())
        .isEqualTo(SimulationStructuralPatchGenerationStatus.INVALID_OUTPUT);
  }
}
