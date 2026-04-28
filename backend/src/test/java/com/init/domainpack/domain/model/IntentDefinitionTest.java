package com.init.domainpack.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("IntentDefinition")
class IntentDefinitionTest {

  private IntentDefinition intent;

  @BeforeEach
  void setUp() {
    intent =
        IntentDefinition.create(
            10L, "HELP_REQUEST", "도움요청", "사용자가 도움을 요청합니다.", 1, "{}", "{}", "[]", "{}");
  }

  @Test
  @DisplayName("changeStatus: DRAFT → PUBLISHED 정상 전환")
  void changeStatus_toPublished_changesStatus() {
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_DRAFT);

    intent.changeStatus(IntentDefinition.STATUS_PUBLISHED);

    assertThat(intent.getStatus()).isEqualTo(IntentDefinition.STATUS_PUBLISHED);
  }

  @Test
  @DisplayName("changeStatus: DRAFT → REJECTED 정상 전환")
  void changeStatus_toRejected_changesStatus() {
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_DRAFT);

    intent.changeStatus(IntentDefinition.STATUS_REJECTED);

    assertThat(intent.getStatus()).isEqualTo(IntentDefinition.STATUS_REJECTED);
  }

  @Test
  @DisplayName("changeStatus: 이미 PUBLISHED 상태면 IllegalStateException")
  void changeStatus_whenAlreadyPublished_throwsException() {
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_PUBLISHED);

    assertThatThrownBy(() -> intent.changeStatus(IntentDefinition.STATUS_PUBLISHED))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("changeStatus: 허용되지 않는 값이면 IllegalArgumentException")
  void changeStatus_withInvalidStatus_throwsException() {
    assertThatThrownBy(() -> intent.changeStatus("DEPRECATED"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("changeStatus: REJECTED 상태면 PUBLISHED로 변경 불가")
  void changeStatus_fromRejectedToPublished_throwsException() {
    ReflectionTestUtils.setField(intent, "status", IntentDefinition.STATUS_REJECTED);

    assertThatThrownBy(() -> intent.changeStatus(IntentDefinition.STATUS_PUBLISHED))
        .isInstanceOf(IllegalStateException.class);
  }

  @Test
  @DisplayName("changeStatus: create 직후(DRAFT) → PUBLISHED 정상 전환 (ReflectionTestUtils 없이)")
  void changeStatus_fromCreateToPublished_changesStatus() {
    intent.changeStatus(IntentDefinition.STATUS_PUBLISHED);

    assertThat(intent.getStatus()).isEqualTo(IntentDefinition.STATUS_PUBLISHED);
  }

  @Test
  @DisplayName("changeStatus: create 직후(DRAFT) → REJECTED 정상 전환 (ReflectionTestUtils 없이)")
  void changeStatus_fromCreateToRejected_changesStatus() {
    intent.changeStatus(IntentDefinition.STATUS_REJECTED);

    assertThat(intent.getStatus()).isEqualTo(IntentDefinition.STATUS_REJECTED);
  }
}
