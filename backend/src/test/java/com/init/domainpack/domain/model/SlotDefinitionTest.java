package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("SlotDefinition")
class SlotDefinitionTest {

  private SlotDefinition slot;

  @BeforeEach
  void setUp() {
    slot =
        SlotDefinition.create(
            10L, "customer_name", "고객명", "상담 시 수집할 고객 이름", "STRING", false, "{}", null, "{}");
  }

  @Test
  @DisplayName("create: 기본 status가 ACTIVE로 설정된다")
  void create_defaultStatusIsActive() {
    assertThat(slot.getStatus()).isEqualTo(SlotDefinition.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("updateFields: 허용 필드 정상 수정")
  void updateFields_withValidInput_updatesFields() {
    slot.updateFields("수정된 이름", "수정된 설명", true, "{\"min\":1}", null, "{\"key\":\"val\"}");

    assertThat(slot.getName()).isEqualTo("수정된 이름");
    assertThat(slot.getDescription()).isEqualTo("수정된 설명");
    assertThat(slot.getIsSensitive()).isTrue();
    assertThat(slot.getValidationRuleJson()).isEqualTo("{\"min\":1}");
    assertThat(slot.getDefaultValueJson()).isNull();
    assertThat(slot.getMetaJson()).isEqualTo("{\"key\":\"val\"}");
  }

  @Test
  @DisplayName("updateFields: null isSensitive, validationRuleJson, metaJson은 기존 값 유지")
  void updateFields_nullOptionalFields_keepsExistingValues() {
    ReflectionTestUtils.setField(slot, "isSensitive", true);
    ReflectionTestUtils.setField(slot, "validationRuleJson", "{\"existing\":true}");
    ReflectionTestUtils.setField(slot, "metaJson", "{\"meta\":1}");

    slot.updateFields("이름", null, null, null, null, null);

    assertThat(slot.getIsSensitive()).isTrue();
    assertThat(slot.getValidationRuleJson()).isEqualTo("{\"existing\":true}");
    assertThat(slot.getMetaJson()).isEqualTo("{\"meta\":1}");
  }

  @Test
  @DisplayName("updateFields: name이 blank이면 IllegalArgumentException")
  void updateFields_withBlankName_throwsException() {
    assertThatThrownBy(() -> slot.updateFields("  ", null, null, null, null, null))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("updateFields: name이 null이면 NullPointerException")
  void updateFields_withNullName_throwsNullPointerException() {
    assertThatThrownBy(() -> slot.updateFields(null, null, null, null, null, null))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("changeStatus: ACTIVE → INACTIVE 정상 전환")
  void changeStatus_toInactive_changesStatus() {
    slot.changeStatus(SlotDefinition.STATUS_INACTIVE);

    assertThat(slot.getStatus()).isEqualTo(SlotDefinition.STATUS_INACTIVE);
  }

  @Test
  @DisplayName("changeStatus: INACTIVE → ACTIVE 정상 전환")
  void changeStatus_toActive_changesStatus() {
    ReflectionTestUtils.setField(slot, "status", SlotDefinition.STATUS_INACTIVE);

    slot.changeStatus(SlotDefinition.STATUS_ACTIVE);

    assertThat(slot.getStatus()).isEqualTo(SlotDefinition.STATUS_ACTIVE);
  }

  @Test
  @DisplayName("changeStatus: 허용되지 않는 값이면 IllegalArgumentException")
  void changeStatus_withInvalidStatus_throwsException() {
    assertThatThrownBy(() -> slot.changeStatus("DEPRECATED"))
        .isInstanceOf(IllegalArgumentException.class);
  }
}
