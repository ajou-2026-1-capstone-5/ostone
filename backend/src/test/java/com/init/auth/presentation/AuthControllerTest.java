package com.init.auth.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willDoNothing;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.AuthService;
import com.init.auth.application.LoginResult;
import com.init.auth.application.SignupResult;
import com.init.auth.application.TokenRefreshResult;
import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.application.exception.InvalidCredentialsException;
import com.init.auth.application.exception.InvalidTokenException;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/**
 * AuthController 슬라이스 테스트.
 *
 * <p>보안 필터를 비활성화하여 컨트롤러 직렬화/역직렬화만 검증한다. SecurityConfig 검증은 별도 통합 테스트에서 수행한다.
 */
@WebMvcTest(
    value = AuthController.class,
    excludeFilters =
        @ComponentScan.Filter(
            type = FilterType.ASSIGNABLE_TYPE,
            classes = JwtAuthenticationFilter.class))
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AuthController")
class AuthControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private AuthService authService;

  // ── signup ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("signup: 신규 이메일 → 201 Created, 사용자 정보 반환")
  void should_201반환_when_회원가입성공() throws Exception {
    // given
    given(authService.signup(any())).willReturn(new SignupResult(1L, "hong@example.com", "홍길동"));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "홍길동",
                      "email": "hong@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1))
        .andExpect(jsonPath("$.email").value("hong@example.com"))
        .andExpect(jsonPath("$.name").value("홍길동"));
  }

  @Test
  @DisplayName("signup: 중복 이메일 → 409 Conflict, EMAIL_ALREADY_EXISTS 코드 반환")
  void should_409반환_when_이메일중복() throws Exception {
    // given
    given(authService.signup(any())).willThrow(new EmailAlreadyExistsException("이미 사용 중인 이메일입니다."));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "홍길동",
                      "email": "existing@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
  }

  @Test
  @DisplayName("signup: 입력값 유효성 실패 (짧은 비밀번호) → 400 Bad Request")
  void should_400반환_when_비밀번호너무짧음() throws Exception {
    // given — password는 8자 이상이어야 함
    mockMvc
        .perform(
            post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "홍길동",
                      "email": "hong@example.com",
                      "password": "short"
                    }
                    """))
        .andExpect(status().isBadRequest());
  }

  // ── login ─────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("login: 올바른 이메일·비밀번호 → 200 OK, 토큰 반환")
  void should_200반환_when_로그인성공() throws Exception {
    // given
    LoginResult loginResult =
        new LoginResult(
            "access-token",
            "refresh-token",
            "Bearer",
            3600L,
            1L,
            "hong@example.com",
            "홍길동",
            "OPERATOR");
    given(authService.login(any())).willReturn(loginResult);

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "email": "hong@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("access-token"))
        .andExpect(jsonPath("$.refreshToken").value("refresh-token"))
        .andExpect(jsonPath("$.tokenType").value("Bearer"))
        .andExpect(jsonPath("$.user.email").value("hong@example.com"))
        .andExpect(jsonPath("$.user.name").value("홍길동"));
  }

  @Test
  @DisplayName("login: 잘못된 비밀번호 → 401 Unauthorized, INVALID_CREDENTIALS 코드 반환")
  void should_401반환_when_잘못된비밀번호() throws Exception {
    // given
    given(authService.login(any()))
        .willThrow(new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "email": "hong@example.com",
                      "password": "wrongpassword"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
  }

  @Test
  @DisplayName("login: 입력값 유효성 실패 (이메일 형식 오류) → 400 Bad Request")
  void should_400반환_when_이메일형식오류() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "email": "not-an-email",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isBadRequest());
  }

  // ── refresh ───────────────────────────────────────────────────────────────

  @Test
  @DisplayName("refresh: 유효한 리프레시 토큰 → 200 OK, 새 토큰 반환")
  void should_200반환_when_토큰갱신성공() throws Exception {
    // given
    TokenRefreshResult refreshResult =
        new TokenRefreshResult("new-access-token", "new-refresh-token", "Bearer", 3600L);
    given(authService.refresh(any())).willReturn(refreshResult);

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "refreshToken": "valid-refresh-token"
                    }
                    """))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.accessToken").value("new-access-token"))
        .andExpect(jsonPath("$.refreshToken").value("new-refresh-token"))
        .andExpect(jsonPath("$.tokenType").value("Bearer"));
  }

  @Test
  @DisplayName("refresh: 만료된 리프레시 토큰 → 401 Unauthorized, INVALID_TOKEN 코드 반환")
  void should_401반환_when_만료된리프레시토큰() throws Exception {
    // given
    given(authService.refresh(any())).willThrow(new InvalidTokenException("만료되거나 폐기된 리프레시 토큰입니다."));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "refreshToken": "expired-token"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
  }

  // ── logout ────────────────────────────────────────────────────────────────

  @Test
  @DisplayName("logout: 유효한 리프레시 토큰 → 204 No Content")
  void should_204반환_when_로그아웃성공() throws Exception {
    // given
    willDoNothing().given(authService).logout(any());

    // when & then
    mockMvc
        .perform(
            post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "refreshToken": "some-refresh-token"
                    }
                    """))
        .andExpect(status().isNoContent());
  }
}
