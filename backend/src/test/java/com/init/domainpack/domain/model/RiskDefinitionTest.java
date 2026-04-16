package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RiskDefinition")
class RiskDefinitionTest {

  @Test
  @DisplayName("허용된 riskLevel은 대문자로 정규화된다")
  void create_withValidRiskLevel_normalizesValue() {
    RiskDefinition riskDefinition =
        RiskDefinition.create(1L, "refund_risk", "환불 리스크", null, "high", null, null, null, null);

    assertThat(riskDefinition.getRiskLevel()).isEqualTo("HIGH");
    assertThat(riskDefinition.getStatus()).isEqualTo(RiskDefinition.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("허용되지 않은 riskLevel이면 예외를 던진다")
  void create_withInvalidRiskLevel_throwsException() {
    assertThatThrownBy(
            () ->
                RiskDefinition.create(
                    1L, "refund_risk", "환불 리스크", null, "unknown", null, null, null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Invalid riskLevel");
  }

  @Test
  @DisplayName("updateFields는 riskLevel을 정규화하고 필드를 갱신한다")
  void updateFields_withValidInput_updatesFields() {
    RiskDefinition riskDefinition =
        RiskDefinition.create(1L, "refund_risk", "환불 리스크", null, "medium", null, null, null, null);

    riskDefinition.updateFields("결제 분쟁 위험", "설명", "critical", "{\"when\":true}", "{}", "[1]", "{}");

    assertThat(riskDefinition.getName()).isEqualTo("결제 분쟁 위험");
    assertThat(riskDefinition.getDescription()).isEqualTo("설명");
    assertThat(riskDefinition.getRiskLevel()).isEqualTo("CRITICAL");
    assertThat(riskDefinition.getTriggerConditionJson()).isEqualTo("{\"when\":true}");
  }

  @Test
  @DisplayName("updateFields에서 name이 null이면 예외를 던진다")
  void updateFields_withNullName_throwsException() {
    RiskDefinition riskDefinition =
        RiskDefinition.create(1L, "refund_risk", "환불 리스크", null, "medium", null, null, null, null);

    assertThatThrownBy(() -> riskDefinition.updateFields(null, null, null, null, null, null, null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("name은 필수 항목입니다.");
  }

  @Test
  @DisplayName("changeStatus는 ACTIVE/INACTIVE만 허용한다")
  void changeStatus_withInvalidValue_throwsException() {
    RiskDefinition riskDefinition =
        RiskDefinition.create(1L, "refund_risk", "환불 리스크", null, "medium", null, null, null, null);

    assertThatThrownBy(() -> riskDefinition.changeStatus("DEPRECATED"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("허용되지 않는 status 값");
  }
}
