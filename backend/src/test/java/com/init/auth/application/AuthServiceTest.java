package com.init.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.application.exception.InvalidCredentialsException;
import com.init.auth.application.exception.InvalidTokenException;
import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.RefreshToken;
import com.init.auth.domain.model.UserStatus;
import com.init.auth.domain.repository.AppUserRepository;
import com.init.auth.domain.repository.RefreshTokenRepository;
import com.init.shared.application.TokenHasher;
import io.jsonwebtoken.Claims;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("AuthService")
class AuthServiceTest {

  @Mock private AppUserRepository userRepository;
  @Mock private RefreshTokenRepository refreshTokenRepository;
  @Mock private JwtService jwtService;
  @Mock private PasswordEncoder passwordEncoder;
  @Mock private TokenHasher tokenHasher;

  private AuthService authService;

  @BeforeEach
  void setUp() {
    given(passwordEncoder.encode(anyString())).willReturn("$2a$10$dummyhash");
    authService =
        new AuthService(
            userRepository, refreshTokenRepository, jwtService, passwordEncoder, tokenHasher);
  }

  // ── signup ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("signup: 신규 이메일 → 회원가입 성공 후 SignupResult 반환")
  void should_회원가입성공_when_신규이메일() {
    // given
    SignupCommand command = new SignupCommand("홍길동", "hong@example.com", "password123");
    given(userRepository.existsByEmail("hong@example.com")).willReturn(false);
    given(passwordEncoder.encode("password123")).willReturn("$2a$10$hashedpassword");

    AppUser savedUser = AppUser.create("홍길동", "hong@example.com", "$2a$10$hashedpassword");
    ReflectionTestUtils.setField(savedUser, "id", 1L);
    given(userRepository.save(any(AppUser.class))).willReturn(savedUser);

    // when
    SignupResult result = authService.signup(command);

    // then
    assertThat(result.id()).isEqualTo(1L);
    assertThat(result.email()).isEqualTo("hong@example.com");
    assertThat(result.name()).isEqualTo("홍길동");
    verify(userRepository).save(any(AppUser.class));
  }

  @Test
  @DisplayName("signup: 중복 이메일 → EmailAlreadyExistsException 발생")
  void should_이메일중복예외발생_when_중복이메일() {
    // given
    SignupCommand command = new SignupCommand("홍길동", "hong@example.com", "password123");
    given(userRepository.existsByEmail("hong@example.com")).willReturn(true);

    // when & then
    assertThatThrownBy(() -> authService.signup(command))
        .isInstanceOf(EmailAlreadyExistsException.class)
        .hasMessageContaining("이미 사용 중인 이메일입니다.");
    verify(userRepository, never()).save(any());
  }

  // ── login ─────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("login: 올바른 비밀번호 → 로그인 성공 후 LoginResult 반환")
  void should_로그인성공_when_올바른비밀번호() {
    // given
    LoginCommand command = new LoginCommand("hong@example.com", "password123");

    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$hashedpassword");
    ReflectionTestUtils.setField(user, "id", 1L);
    given(userRepository.findByEmail("hong@example.com")).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password123", "$2a$10$hashedpassword")).willReturn(true);

    given(jwtService.generateAccessToken(1L, "hong@example.com", "OPERATOR"))
        .willReturn("access-token-value");
    given(jwtService.generateRefreshToken(1L)).willReturn("refresh-token-value");
    given(jwtService.getRefreshTokenExpiration()).willReturn(604800000L);
    given(jwtService.getAccessTokenExpiration()).willReturn(3600000L);
    given(tokenHasher.hash("refresh-token-value")).willReturn("sha256-refresh-hash");

    RefreshToken savedToken =
        RefreshToken.create(1L, "sha256-refresh-hash", OffsetDateTime.now().plusDays(7));
    given(refreshTokenRepository.save(any(RefreshToken.class))).willReturn(savedToken);

    // when
    LoginResult result = authService.login(command);

    // then
    assertThat(result.accessToken()).isEqualTo("access-token-value");
    assertThat(result.refreshToken()).isEqualTo("refresh-token-value");
    assertThat(result.email()).isEqualTo("hong@example.com");
    assertThat(result.name()).isEqualTo("홍길동");
    assertThat(result.role()).isEqualTo("OPERATOR");
  }

  @Test
  @DisplayName("login: 틀린 비밀번호 → InvalidCredentialsException 발생")
  void should_잘못된비밀번호예외발생_when_틀린비밀번호() {
    // given
    LoginCommand command = new LoginCommand("hong@example.com", "wrongpassword");

    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$hashedpassword");
    given(userRepository.findByEmail("hong@example.com")).willReturn(Optional.of(user));
    given(passwordEncoder.matches("wrongpassword", "$2a$10$hashedpassword")).willReturn(false);

    // when & then
    assertThatThrownBy(() -> authService.login(command))
        .isInstanceOf(InvalidCredentialsException.class)
        .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  @Test
  @DisplayName("login: 존재하지 않는 이메일 → InvalidCredentialsException 발생")
  void should_잘못된비밀번호예외발생_when_존재하지않는이메일() {
    // given
    LoginCommand command = new LoginCommand("nouser@example.com", "anypassword");
    given(userRepository.findByEmail("nouser@example.com")).willReturn(Optional.empty());
    // 타이밍 공격 방지를 위해 dummyHash와 비교
    given(passwordEncoder.matches(anyString(), anyString())).willReturn(false);

    // when & then
    assertThatThrownBy(() -> authService.login(command))
        .isInstanceOf(InvalidCredentialsException.class)
        .hasMessageContaining("이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  @Test
  @DisplayName("login: 비활성화된 계정 → InvalidCredentialsException 발생")
  void should_비활성계정예외발생_when_INACTIVE계정() {
    // given
    LoginCommand command = new LoginCommand("hong@example.com", "password123");

    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$hashedpassword");
    ReflectionTestUtils.setField(user, "status", UserStatus.INACTIVE);
    given(userRepository.findByEmail("hong@example.com")).willReturn(Optional.of(user));
    given(passwordEncoder.matches("password123", "$2a$10$hashedpassword")).willReturn(true);

    // when & then
    assertThatThrownBy(() -> authService.login(command))
        .isInstanceOf(InvalidCredentialsException.class)
        .hasMessageContaining("비활성화된 계정입니다.");
  }

  // ── refresh ───────────────────────────────────────────────────────────────

  @Test
  @DisplayName("refresh: 유효한 리프레시 토큰 → 토큰 갱신 성공")
  void should_토큰갱신성공_when_유효한리프레시토큰() {
    // given
    TokenRefreshCommand command = new TokenRefreshCommand("valid-refresh-token");
    given(tokenHasher.hash("valid-refresh-token")).willReturn("sha256-hash-of-token");

    RefreshToken refreshToken =
        RefreshToken.create(1L, "sha256-hash-of-token", OffsetDateTime.now().plusDays(7));
    given(refreshTokenRepository.findByTokenHash("sha256-hash-of-token"))
        .willReturn(Optional.of(refreshToken));

    Claims claims = org.mockito.Mockito.mock(Claims.class);
    given(jwtService.parseClaims("valid-refresh-token")).willReturn(claims);
    given(claims.get("type", String.class)).willReturn("refresh");
    given(claims.getSubject()).willReturn("1");
    AppUser user = AppUser.create("홍길동", "hong@example.com", "$2a$10$hashedpassword");
    ReflectionTestUtils.setField(user, "id", 1L);
    given(userRepository.findById(1L)).willReturn(Optional.of(user));

    given(jwtService.generateAccessToken(1L, "hong@example.com", "OPERATOR"))
        .willReturn("new-access-token");
    given(jwtService.generateRefreshToken(1L)).willReturn("new-refresh-token");
    given(jwtService.getRefreshTokenExpiration()).willReturn(604800000L);
    given(jwtService.getAccessTokenExpiration()).willReturn(3600000L);
    given(tokenHasher.hash("new-refresh-token")).willReturn("sha256-new-refresh-hash");

    RefreshToken newSavedToken =
        RefreshToken.create(1L, "sha256-new-refresh-hash", OffsetDateTime.now().plusDays(7));
    given(refreshTokenRepository.save(any(RefreshToken.class))).willReturn(newSavedToken);

    // when
    TokenRefreshResult result = authService.refresh(command);

    // then
    assertThat(result.accessToken()).isEqualTo("new-access-token");
    assertThat(result.refreshToken()).isEqualTo("new-refresh-token");
    assertThat(result.tokenType()).isEqualTo("Bearer");
  }

  @Test
  @DisplayName("refresh: 만료된 리프레시 토큰 → InvalidTokenException 발생")
  void should_유효하지않은토큰예외발생_when_만료토큰() {
    // given
    TokenRefreshCommand command = new TokenRefreshCommand("expired-refresh-token");
    given(tokenHasher.hash("expired-refresh-token")).willReturn("sha256-hash-expired");

    // 만료된 토큰 (expiresAt이 과거)
    RefreshToken expiredToken =
        RefreshToken.create(1L, "sha256-hash-expired", OffsetDateTime.now().minusSeconds(1));
    given(refreshTokenRepository.findByTokenHash("sha256-hash-expired"))
        .willReturn(Optional.of(expiredToken));

    // when & then
    assertThatThrownBy(() -> authService.refresh(command))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("만료되거나 폐기된 리프레시 토큰입니다.");
  }

  @Test
  @DisplayName("refresh: 존재하지 않는 토큰 해시 → InvalidTokenException 발생")
  void should_유효하지않은토큰예외발생_when_토큰없음() {
    // given
    TokenRefreshCommand command = new TokenRefreshCommand("unknown-token");
    given(tokenHasher.hash("unknown-token")).willReturn("sha256-hash-unknown");
    given(refreshTokenRepository.findByTokenHash("sha256-hash-unknown"))
        .willReturn(Optional.empty());

    // when & then
    assertThatThrownBy(() -> authService.refresh(command))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("유효하지 않은 리프레시 토큰입니다.");
  }

  @Test
  @DisplayName("refresh: 폐기된(revoked) 리프레시 토큰 → InvalidTokenException 발생")
  void should_유효하지않은토큰예외발생_when_폐기된토큰() {
    // given
    TokenRefreshCommand command = new TokenRefreshCommand("revoked-token");
    given(tokenHasher.hash("revoked-token")).willReturn("sha256-hash-revoked");

    RefreshToken revokedToken =
        RefreshToken.create(1L, "sha256-hash-revoked", OffsetDateTime.now().plusDays(7));
    revokedToken.revoke();
    given(refreshTokenRepository.findByTokenHash("sha256-hash-revoked"))
        .willReturn(Optional.of(revokedToken));

    // when & then
    assertThatThrownBy(() -> authService.refresh(command))
        .isInstanceOf(InvalidTokenException.class)
        .hasMessageContaining("만료되거나 폐기된 리프레시 토큰입니다.");
  }

  // ── logout ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("logout: 유효한 리프레시 토큰 → 토큰 폐기 후 저장")
  void should_토큰폐기_when_유효한토큰로그아웃() {
    // given
    LogoutCommand command = new LogoutCommand("valid-token");
    given(tokenHasher.hash("valid-token")).willReturn("sha256-hash");

    RefreshToken refreshToken =
        RefreshToken.create(1L, "sha256-hash", OffsetDateTime.now().plusDays(7));
    given(refreshTokenRepository.findByTokenHash("sha256-hash"))
        .willReturn(Optional.of(refreshToken));

    // when
    authService.logout(command);

    // then
    assertThat(refreshToken.isValid()).isFalse();
    verify(refreshTokenRepository).save(refreshToken);
  }

  @Test
  @DisplayName("logout: 존재하지 않는 토큰 → 예외 없이 무시")
  void should_정상종료_when_없는토큰로그아웃() {
    // given
    LogoutCommand command = new LogoutCommand("ghost-token");
    given(tokenHasher.hash("ghost-token")).willReturn("sha256-ghost");
    given(refreshTokenRepository.findByTokenHash("sha256-ghost")).willReturn(Optional.empty());

    // when (no exception expected)
    authService.logout(command);

    // then
    verify(refreshTokenRepository, never()).save(any());
  }
}
