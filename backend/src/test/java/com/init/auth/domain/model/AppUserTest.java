package com.init.auth.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.OffsetDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("AppUser 도메인 모델")
class AppUserTest {

  // ── 팩토리 ──────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("create: 올바른 파라미터 → ACTIVE 상태의 OPERATOR 역할 사용자 생성")
  void should_ACTIVE_OPERATOR사용자생성_when_올바른파라미터() {
    // given
    String name = "홍길동";
    String email = "hong@example.com";
    String hash = "$2a$10$dummyhash";

    // when
    AppUser user = AppUser.create(name, email, hash);

    // then
    assertThat(user.getName()).isEqualTo(name);
    assertThat(user.getEmail()).isEqualTo(email);
    assertThat(user.getPasswordHash()).isEqualTo(hash);
    assertThat(user.getRole()).isEqualTo(UserRole.OPERATOR);
    assertThat(user.getStatus()).isEqualTo(UserStatus.ACTIVE);
    assertThat(user.isPasswordResetRequired()).isFalse();
  }

  @Test
  @DisplayName("create: 이름이 null → IllegalArgumentException 발생")
  void should_예외발생_when_이름이null() {
    assertThatThrownBy(() -> AppUser.create(null, "hong@example.com", "hash"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("name must not be null or blank");
  }

  @Test
  @DisplayName("create: 이름이 공백 → IllegalArgumentException 발생")
  void should_예외발생_when_이름이공백() {
    assertThatThrownBy(() -> AppUser.create("  ", "hong@example.com", "hash"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("name must not be null or blank");
  }

  @Test
  @DisplayName("create: 이메일이 null → IllegalArgumentException 발생")
  void should_예외발생_when_이메일이null() {
    assertThatThrownBy(() -> AppUser.create("홍길동", null, "hash"))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("email must not be null or blank");
  }

  @Test
  @DisplayName("create: passwordHash가 null → IllegalArgumentException 발생")
  void should_예외발생_when_해시가null() {
    assertThatThrownBy(() -> AppUser.create("홍길동", "hong@example.com", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("passwordHash must not be null or blank");
  }

  // ── initiatePasswordReset ─────────────────────────────────────────────────

  @Test
  @DisplayName("initiatePasswordReset: 유효한 파라미터 → 리셋 토큰 저장")
  void should_리셋토큰저장_when_유효한파라미터() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");
    String tokenHash = "sha256hashvalue";
    OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(30);

    // when
    user.initiatePasswordReset(tokenHash, expiresAt);

    // then
    assertThat(user.isPasswordResetTokenValid()).isTrue();
  }

  @Test
  @DisplayName("initiatePasswordReset: tokenHash가 null → IllegalArgumentException 발생")
  void should_예외발생_when_tokenHash가null() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");

    // when & then
    assertThatThrownBy(() -> user.initiatePasswordReset(null, OffsetDateTime.now().plusMinutes(30)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("tokenHash must not be null or blank");
  }

  @Test
  @DisplayName("initiatePasswordReset: expiresAt이 null → IllegalArgumentException 발생")
  void should_예외발생_when_expiresAt이null() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");

    // when & then
    assertThatThrownBy(() -> user.initiatePasswordReset("sha256hash", null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("expiresAt must not be null");
  }

  // ── isPasswordResetTokenValid ─────────────────────────────────────────────

  @Test
  @DisplayName("isPasswordResetTokenValid: 토큰 없음 → false 반환")
  void should_false반환_when_토큰없음() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");

    // when & then
    assertThat(user.isPasswordResetTokenValid()).isFalse();
  }

  @Test
  @DisplayName("isPasswordResetTokenValid: 만료된 토큰 → false 반환")
  void should_false반환_when_만료된토큰() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");
    user.initiatePasswordReset("sha256hash", OffsetDateTime.now().minusMinutes(1));

    // when & then
    assertThat(user.isPasswordResetTokenValid()).isFalse();
  }

  @Test
  @DisplayName("isPasswordResetTokenValid: 유효한 토큰 → true 반환")
  void should_true반환_when_유효한토큰() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$dummyhash");
    user.initiatePasswordReset("sha256hash", OffsetDateTime.now().plusMinutes(30));

    // when & then
    assertThat(user.isPasswordResetTokenValid()).isTrue();
  }

  // ── completePasswordReset ─────────────────────────────────────────────────

  @Test
  @DisplayName("completePasswordReset: 새 비밀번호 해시 → 해시 교체, 토큰 초기화, passwordResetRequired false")
  void should_비밀번호재설정완료_when_새해시제공() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$oldhash");
    user.initiatePasswordReset("sha256hash", OffsetDateTime.now().plusMinutes(30));

    // when
    user.completePasswordReset("$2a$10$newhash");

    // then
    assertThat(user.getPasswordHash()).isEqualTo("$2a$10$newhash");
    assertThat(user.isPasswordResetRequired()).isFalse();
    assertThat(user.isPasswordResetTokenValid()).isFalse();
  }

  @Test
  @DisplayName("completePasswordReset: null 해시 → IllegalArgumentException 발생")
  void should_예외발생_when_새해시가null() {
    // given
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$oldhash");

    // when & then
    assertThatThrownBy(() -> user.completePasswordReset(null))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("newPasswordHash must not be null or blank");
  }
}
