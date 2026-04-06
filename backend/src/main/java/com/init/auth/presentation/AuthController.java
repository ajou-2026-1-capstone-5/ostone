package com.init.auth.presentation;

import com.init.auth.application.AuthService;
import com.init.auth.presentation.dto.LoginRequest;
import com.init.auth.presentation.dto.LoginResponse;
import com.init.auth.presentation.dto.LogoutRequest;
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
    return ResponseEntity.ok(authService.login(request));
  }

  @PostMapping("/signup")
  public ResponseEntity<SignupResponse> signup(@Valid @RequestBody SignupRequest request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(authService.signup(request));
  }

  @PostMapping("/refresh")
  public ResponseEntity<TokenRefreshResponse> refresh(
      @Valid @RequestBody TokenRefreshRequest request) {
    return ResponseEntity.ok(authService.refresh(request));
  }

  @PostMapping("/logout")
  public ResponseEntity<Void> logout(@Valid @RequestBody LogoutRequest request) {
    authService.logout(request);
    return ResponseEntity.noContent().build();
  }
}
