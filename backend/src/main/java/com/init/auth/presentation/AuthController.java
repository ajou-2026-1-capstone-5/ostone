package com.init.auth.presentation;

import com.init.auth.application.AuthService;
import com.init.auth.application.LoginCommand;
import com.init.auth.application.LoginResult;
import com.init.auth.application.LogoutCommand;
import com.init.auth.application.PasswordResetCompleteCommand;
import com.init.auth.application.PasswordResetInitCommand;
import com.init.auth.application.PasswordResetInitResult;
import com.init.auth.application.SignupCommand;
import com.init.auth.application.SignupResult;
import com.init.auth.application.TokenRefreshCommand;
import com.init.auth.application.TokenRefreshResult;
import com.init.auth.application.exception.InvalidTokenException;
import com.init.auth.presentation.dto.LoginRequest;
import com.init.auth.presentation.dto.LoginResponse;
import com.init.auth.presentation.dto.PasswordResetCompleteRequest;
import com.init.auth.presentation.dto.PasswordResetInitRequest;
import com.init.auth.presentation.dto.PasswordResetInitResponse;
import com.init.auth.presentation.dto.SignupRequest;
import com.init.auth.presentation.dto.SignupResponse;
import com.init.auth.presentation.dto.TokenRefreshResponse;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private static final String REFRESH_TOKEN_COOKIE_NAME = "ostone_refresh_token";
  private static final String REFRESH_TOKEN_COOKIE_PATH = "/api/v1/auth";

  private final AuthService authService;
  private final boolean refreshCookieSecure;
  private final String refreshCookieSameSite;
  private final Duration refreshCookieMaxAge;

  public AuthController(
      AuthService authService,
      @Value("${auth.refresh-cookie.secure:false}") boolean refreshCookieSecure,
      @Value("${auth.refresh-cookie.same-site:Lax}") String refreshCookieSameSite,
      @Value("${jwt.refresh-token-expiration}") long refreshTokenExpiration) {
    if (refreshTokenExpiration <= 0) {
      throw new IllegalArgumentException("jwt.refresh-token-expiration must be > 0");
    }
    this.authService = authService;
    this.refreshCookieSecure = refreshCookieSecure;
    this.refreshCookieSameSite =
        StringUtils.hasText(refreshCookieSameSite) ? refreshCookieSameSite : "Lax";
    this.refreshCookieMaxAge = Duration.ofMillis(refreshTokenExpiration);
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    LoginResult result = authService.login(new LoginCommand(request.email(), request.password()));
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, createRefreshTokenCookie(result.refreshToken()).toString())
        .body(
            new LoginResponse(
                result.accessToken(),
                result.tokenType(),
                result.expiresIn(),
                new LoginResponse.UserInfo(
                    result.userId(), result.email(), result.name(), result.role())));
  }

  @PostMapping("/signup")
  public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
    SignupResult result =
        authService.signup(new SignupCommand(request.name(), request.email(), request.password()));
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(new SignupResponse(result.id(), result.email(), result.name()));
  }

  @PostMapping("/refresh")
  public ResponseEntity<TokenRefreshResponse> refresh(
      @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String refreshToken) {
    TokenRefreshResult result =
        authService.refresh(new TokenRefreshCommand(requireRefreshToken(refreshToken)));
    return ResponseEntity.ok()
        .header(HttpHeaders.SET_COOKIE, createRefreshTokenCookie(result.refreshToken()).toString())
        .body(
            new TokenRefreshResponse(result.accessToken(), result.tokenType(), result.expiresIn()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(
      @CookieValue(name = REFRESH_TOKEN_COOKIE_NAME, required = false) String refreshToken) {
    if (StringUtils.hasText(refreshToken)) {
      authService.logout(new LogoutCommand(refreshToken));
    }
    return ResponseEntity.noContent()
        .header(HttpHeaders.SET_COOKIE, expireRefreshTokenCookie().toString())
        .build();
  }

  @PostMapping("/password-reset/init")
  public ResponseEntity<PasswordResetInitResponse> passwordResetInit(
      @Valid @RequestBody PasswordResetInitRequest request) {
    PasswordResetInitResult result =
        authService.passwordResetInit(new PasswordResetInitCommand(request.email()));
    // TODO: emailService.sendPasswordResetEmail(request.email(), result.rawToken());
    return ResponseEntity.ok(new PasswordResetInitResponse("이메일로 비밀번호 재설정 안내를 발송했습니다."));
  }

  @PostMapping("/password-reset/complete")
  public ResponseEntity<Void> passwordResetComplete(
      @Valid @RequestBody PasswordResetCompleteRequest request) {
    authService.passwordResetComplete(
        new PasswordResetCompleteCommand(request.resetToken(), request.newPassword()));
    return ResponseEntity.noContent().build();
  }

  // AuthController — 현재 TODO
  // TODO: emailService.sendPasswordResetEmail(request.email(), result.rawToken());

  private String requireRefreshToken(String refreshToken) {
    if (!StringUtils.hasText(refreshToken)) {
      throw new InvalidTokenException("리프레시 토큰이 필요합니다.");
    }
    return refreshToken;
  }

  private ResponseCookie createRefreshTokenCookie(String refreshToken) {
    return baseRefreshTokenCookie(refreshToken).maxAge(refreshCookieMaxAge).build();
  }

  private ResponseCookie expireRefreshTokenCookie() {
    return baseRefreshTokenCookie("").maxAge(Duration.ZERO).build();
  }

  private ResponseCookie.ResponseCookieBuilder baseRefreshTokenCookie(String value) {
    return ResponseCookie.from(REFRESH_TOKEN_COOKIE_NAME, value)
        .httpOnly(true)
        .secure(refreshCookieSecure)
        .sameSite(refreshCookieSameSite)
        .path(REFRESH_TOKEN_COOKIE_PATH);
  }
}
