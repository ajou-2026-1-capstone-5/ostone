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
import com.init.auth.presentation.dto.LoginRequest;
import com.init.auth.presentation.dto.LoginResponse;
import com.init.auth.presentation.dto.LogoutRequest;
import com.init.auth.presentation.dto.PasswordResetCompleteRequest;
import com.init.auth.presentation.dto.PasswordResetInitRequest;
import com.init.auth.presentation.dto.PasswordResetInitResponse;
import com.init.auth.presentation.dto.SignupRequest;
import com.init.auth.presentation.dto.SignupResponse;
import com.init.auth.presentation.dto.TokenRefreshRequest;
import com.init.auth.presentation.dto.TokenRefreshResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

  private final AuthService authService;

  public AuthController(AuthService authService) {
    this.authService = authService;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
    LoginResult result = authService.login(new LoginCommand(request.email(), request.password()));
    return ResponseEntity.ok(
        new LoginResponse(
            result.accessToken(),
            result.refreshToken(),
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
      @Valid @RequestBody TokenRefreshRequest request) {
    TokenRefreshResult result =
        authService.refresh(new TokenRefreshCommand(request.refreshToken()));
    return ResponseEntity.ok(
        new TokenRefreshResponse(
            result.accessToken(), result.refreshToken(), result.tokenType(), result.expiresIn()));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
    authService.logout(new LogoutCommand(request.refreshToken()));
    return ResponseEntity.noContent().build();
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

}
