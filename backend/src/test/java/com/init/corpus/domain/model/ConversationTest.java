package com.init.corpus.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("Conversation")
class ConversationTest {

  @Test
  @DisplayName("유효한 입력으로 Conversation을 생성한다")
  void should_생성성공_when_유효한입력() {
    // when
    Conversation conv = Conversation.create(1L, "case-001", null, null, null, null, null, null, 3);

    // then
    assertThat(conv.getDatasetId()).isEqualTo(1L);
    assertThat(conv.getTurnCount()).isEqualTo(3);
  }

  @Test
  @DisplayName("languageCode가 null이면 기본값 'ko'가 적용된다")
  void should_languageCode_ko_when_null() {
    // when
    Conversation conv = Conversation.create(1L, null, null, null, null, null, null, null, 0);

    // then
    assertThat(conv.getLanguageCode()).isEqualTo("ko");
  }

  @Test
  @DisplayName("languageCode가 빈 문자열이면 기본값 'ko'가 적용된다")
  void should_languageCode_ko_when_blank() {
    // when
    Conversation conv = Conversation.create(1L, null, null, "  ", null, null, null, null, 0);

    // then
    assertThat(conv.getLanguageCode()).isEqualTo("ko");
  }

  @Test
  @DisplayName("datasetId가 null이면 NullPointerException을 던진다")
  void should_NPE_when_datasetIdNull() {
    // when & then
    assertThatThrownBy(() -> Conversation.create(null, null, null, null, null, null, null, null, 0))
        .isInstanceOf(NullPointerException.class);
  }

  @Test
  @DisplayName("turnCount가 음수이면 IllegalArgumentException을 던진다")
  void should_IAE_when_turnCountNegative() {
    // when & then
    assertThatThrownBy(() -> Conversation.create(1L, null, null, null, null, null, null, null, -1))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("endedAt이 startedAt보다 이전이면 IllegalArgumentException을 던진다")
  void should_IAE_when_endedAtBeforeStartedAt() {
    // given
    OffsetDateTime start = OffsetDateTime.now();
    OffsetDateTime end = start.minusMinutes(1);

    // when & then
    assertThatThrownBy(() -> Conversation.create(1L, null, null, null, start, end, null, null, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("externalCaseId가 255자를 초과하면 IllegalArgumentException을 던진다")
  void should_IAE_when_externalCaseIdExceeds255() {
    // given
    String tooLong = "a".repeat(256);

    // when & then
    assertThatThrownBy(
            () -> Conversation.create(1L, tooLong, null, null, null, null, null, null, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("channel이 50자를 초과하면 IllegalArgumentException을 던진다")
  void should_IAE_when_channelExceeds50() {
    // given
    String tooLong = "a".repeat(51);

    // when & then
    assertThatThrownBy(
            () -> Conversation.create(1L, null, tooLong, null, null, null, null, null, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("languageCode가 20자를 초과하면 IllegalArgumentException을 던진다")
  void should_IAE_when_languageCodeExceeds20() {
    // given
    String tooLong = "a".repeat(21);

    // when & then
    assertThatThrownBy(
            () -> Conversation.create(1L, null, null, tooLong, null, null, null, null, 0))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("updateMetaJson에 빈 문자열을 전달하면 IllegalArgumentException을 던진다")
  void should_IAE_when_metaJsonBlank() {
    // given
    Conversation conv = Conversation.create(1L, null, null, null, null, null, null, null, 0);

    // when & then
    assertThatThrownBy(() -> conv.updateMetaJson("")).isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("updateMetaJson에 유효하지 않은 JSON을 전달하면 IllegalArgumentException을 던진다")
  void should_IAE_when_invalidJson() {
    // given
    Conversation conv = Conversation.create(1L, null, null, null, null, null, null, null, 0);

    // when & then
    assertThatThrownBy(() -> conv.updateMetaJson("not-json"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  @DisplayName("updateMetaJson에 null을 전달하면 NullPointerException을 던진다")
  void should_NPE_when_metaJsonNull() {
    // given
    Conversation conv = Conversation.create(1L, null, null, null, null, null, null, null, 0);

    // when & then
    assertThatThrownBy(() -> conv.updateMetaJson(null)).isInstanceOf(NullPointerException.class);
  }
}
