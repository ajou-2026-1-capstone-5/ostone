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
}
