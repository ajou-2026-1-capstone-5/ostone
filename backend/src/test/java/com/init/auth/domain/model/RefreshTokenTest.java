package com.init.auth.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;

@DisplayName("RefreshToken 도메인 모델")
@ResourceLock(value = "RefreshToken.clock", mode = ResourceAccessMode.READ_WRITE)
class RefreshTokenTest {

  private static final Clock FIXED_NOW =
      Clock.fixed(Instant.parse("2026-04-10T00:00:00Z"), ZoneOffset.UTC);

  @AfterEach
  void resetClock() {
    RefreshToken.setClock(Clock.systemDefaultZone());
  }

  // ── create ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("create: 올바른 파라미터 → 토큰 생성 성공")
  void should_토큰생성_when_올바른파라미터() {
    // given
    RefreshToken.setClock(FIXED_NOW);
    Long userId = 1L;
    String tokenHash = "sha256hash_value";
    OffsetDateTime expiresAt = OffsetDateTime.now(FIXED_NOW).plusDays(7);

    // when
    RefreshToken token = RefreshToken.create(userId, tokenHash, expiresAt);

    // then
    assertThat(token.getUserId()).isEqualTo(userId);
    assertThat(token.getTokenHash()).isEqualTo(tokenHash);
    assertThat(token.isValid()).isTrue();
  }

  @Test
  @DisplayName("create: userId가 null → NullPointerException 발생")
  void should_예외발생_when_userId가null() {
    assertThatThrownBy(
            () -> RefreshToken.create(null, "sha256hash", OffsetDateTime.now().plusDays(7)))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("userId must not be null");
  }

  @Test
  @DisplayName("create: tokenHash가 null → IllegalArgumentException 발생")
  void should_예외발생_when_tokenHash가null() {
    assertThatThrownBy(() -> RefreshToken.create(1L, null, OffsetDateTime.now().plusDays(7)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("tokenHash must not be null or blank");
  }

  @Test
  @DisplayName("create: tokenHash가 공백 → IllegalArgumentException 발생")
  void should_예외발생_when_tokenHash가공백() {
    assertThatThrownBy(() -> RefreshToken.create(1L, "  ", OffsetDateTime.now().plusDays(7)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("tokenHash must not be null or blank");
  }

  @Test
  @DisplayName("create: expiresAt이 null → NullPointerException 발생")
  void should_예외발생_when_expiresAt이null() {
    assertThatThrownBy(() -> RefreshToken.create(1L, "sha256hash", null))
        .isInstanceOf(NullPointerException.class)
        .hasMessageContaining("expiresAt must not be null");
  }

  // ── isValid (만료 검사) ───────────────────────────────────────────────────

  @Test
  @DisplayName("isValid: 만료 전 → true 반환")
  void should_유효함_when_만료전() {
    // given
    RefreshToken.setClock(FIXED_NOW);
    OffsetDateTime expiresAt = OffsetDateTime.now(FIXED_NOW).plusDays(7);
    RefreshToken token = RefreshToken.create(1L, "sha256hash", expiresAt);

    // when & then
    assertThat(token.isValid()).isTrue();
  }

  @Test
  @DisplayName("isValid: 만료 시간 지남 → false 반환")
  void should_만료됨_when_만료시간지남() {
    // given
    RefreshToken.setClock(FIXED_NOW);
    OffsetDateTime expiresAt = OffsetDateTime.now(FIXED_NOW).minusSeconds(1);
    RefreshToken token = RefreshToken.create(1L, "sha256hash", expiresAt);

    // when & then
    assertThat(token.isValid()).isFalse();
  }

  // ── isValid (revoke 검사) ─────────────────────────────────────────────────

  @Test
  @DisplayName("isValid: revoke 후 → false 반환")
  void should_무효화됨_when_revoke후() {
    // given
    RefreshToken.setClock(FIXED_NOW);
    OffsetDateTime expiresAt = OffsetDateTime.now(FIXED_NOW).plusDays(7);
    RefreshToken token = RefreshToken.create(1L, "sha256hash", expiresAt);

    // when
    token.revoke();

    // then
    assertThat(token.isValid()).isFalse();
  }

  // ── revoke ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("revoke: 호출 전 유효 → 호출 후 isValid false")
  void should_isValid_false_when_revoke호출() {
    // given
    RefreshToken.setClock(FIXED_NOW);
    RefreshToken token =
        RefreshToken.create(1L, "sha256hash", OffsetDateTime.now(FIXED_NOW).plusDays(7));
    assertThat(token.isValid()).isTrue();

    // when
    token.revoke();

    // then
    assertThat(token.isValid()).isFalse();
  }
}
