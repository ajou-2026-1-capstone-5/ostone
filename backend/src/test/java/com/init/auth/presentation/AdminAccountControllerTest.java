package com.init.auth.presentation;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.init.auth.application.CreateSuperAdminResult;
import com.init.auth.application.CreateSuperAdminUseCase;
import com.init.auth.application.JwtService;
import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.shared.infrastructure.security.ApiAuthenticationEntryPoint;
import com.init.shared.infrastructure.security.JwtAuthenticationFilter;
import com.init.shared.infrastructure.security.SecurityConfig;
import com.init.shared.presentation.GlobalExceptionHandler;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import java.util.Date;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AdminAccountController.class)
@Import({
  SecurityConfig.class,
  JwtAuthenticationFilter.class,
  ApiAuthenticationEntryPoint.class,
  GlobalExceptionHandler.class
})
@TestPropertySource(properties = "cors.allowed-origins=http://localhost:5173")
@DisplayName("AdminAccountController")
class AdminAccountControllerTest {

  @Autowired private MockMvc mockMvc;

  @MockitoBean private CreateSuperAdminUseCase createSuperAdminUseCase;
  @MockitoBean private JwtService jwtService;

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: SUPER_ADMIN JWT → 201 Created")
  void should_201반환_when_SUPER_ADMIN요청() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");
    given(createSuperAdminUseCase.execute(any()))
        .willReturn(
            new CreateSuperAdminResult(10L, "new-super@example.com", "운영 관리자", "SUPER_ADMIN"));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "운영 관리자",
                      "email": "new-super@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(10))
        .andExpect(jsonPath("$.email").value("new-super@example.com"))
        .andExpect(jsonPath("$.name").value("운영 관리자"))
        .andExpect(jsonPath("$.role").value("SUPER_ADMIN"));
  }

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: OPERATOR JWT → 403 Forbidden")
  void should_403반환_when_OPERATOR요청() throws Exception {
    // given
    givenBearerToken("operator-token", "OPERATOR");

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .header("Authorization", "Bearer operator-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "운영 관리자",
                      "email": "new-super@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isForbidden());
  }

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: JWT 없음 → 401 Unauthorized")
  void should_401반환_when_토큰없음() throws Exception {
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "운영 관리자",
                      "email": "new-super@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
  }

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: 입력값 유효성 실패 → 400 Bad Request")
  void should_400반환_when_입력값유효성실패() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "",
                      "email": "not-email",
                      "password": "short"
                    }
                    """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: 비밀번호가 72 UTF-8 bytes 초과 → 400 Bad Request")
  void should_400반환_when_비밀번호가72바이트초과() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");
    String oversizedUtf8Password = "가".repeat(25);

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "운영 관리자",
                      "email": "new-super@example.com",
                      "password": "%s"
                    }
                    """
                        .formatted(oversizedUtf8Password)))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
  }

  @Test
  @DisplayName("POST /api/v1/admin/super-admins: 중복 이메일 → 409 Conflict")
  void should_409반환_when_이메일중복() throws Exception {
    // given
    givenSuperAdminBearerToken("super-admin-token");
    given(createSuperAdminUseCase.execute(any()))
        .willThrow(new EmailAlreadyExistsException("이미 사용 중인 이메일입니다."));

    // when & then
    mockMvc
        .perform(
            post("/api/v1/admin/super-admins")
                .header("Authorization", "Bearer super-admin-token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(
                    """
                    {
                      "name": "운영 관리자",
                      "email": "new-super@example.com",
                      "password": "password123"
                    }
                    """))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.code").value("EMAIL_ALREADY_EXISTS"));
  }

  private void givenSuperAdminBearerToken(String token) {
    givenBearerToken(token, "SUPER_ADMIN");
  }

  private void givenBearerToken(String token, String role) {
    Claims claims =
        Jwts.claims()
            .subject("1")
            .add("type", "access")
            .add("role", role)
            .expiration(new Date(System.currentTimeMillis() + 60_000))
            .build();
    given(jwtService.parseClaims(token)).willReturn(claims);
    given(jwtService.isTokenValid(claims)).willReturn(true);
    given(jwtService.isAccessToken(claims)).willReturn(true);
  }
}
