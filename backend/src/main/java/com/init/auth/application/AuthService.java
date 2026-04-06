package com.init.auth.application;

import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.application.exception.InvalidCredentialsException;
import com.init.auth.application.exception.InvalidTokenException;
import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.RefreshToken;
import com.init.auth.domain.model.UserStatus;
import com.init.auth.domain.repository.AppUserRepository;
import com.init.auth.domain.repository.RefreshTokenRepository;
import com.init.auth.presentation.dto.LoginRequest;
import com.init.auth.presentation.dto.LoginResponse;
import com.init.auth.presentation.dto.LogoutRequest;
import com.init.auth.presentation.dto.SignupRequest;
import com.init.auth.presentation.dto.SignupResponse;
import com.init.auth.presentation.dto.TokenRefreshRequest;
import com.init.auth.presentation.dto.TokenRefreshResponse;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class AuthService {

  private final AppUserRepository userRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;

  public AuthService(
      AppUserRepository userRepository,
      RefreshTokenRepository refreshTokenRepository,
      JwtService jwtService,
      PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
  }

  public LoginResponse login(LoginRequest request) {
    AppUser user =
        userRepository
            .findByEmail(request.email())
            .orElseThrow(() -> new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));

    if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
      throw new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    if (user.getStatus() != UserStatus.ACTIVE) {
      throw new InvalidCredentialsException("비활성화된 계정입니다.");
    }

    return issueTokens(user);
  }

  public SignupResponse signup(SignupRequest request) {
    if (userRepository.existsByEmail(request.email())) {
      throw new EmailAlreadyExistsException("이미 사용 중인 이메일입니다.");
    }

    AppUser user =
        AppUser.create(request.name(), request.email(), passwordEncoder.encode(request.password()));
    AppUser saved = userRepository.save(user);

    return new SignupResponse(saved.getId(), saved.getEmail(), saved.getName());
  }

  public TokenRefreshResponse refresh(TokenRefreshRequest request) {
    String tokenHash = computeTokenHash(request.refreshToken());

    RefreshToken refreshToken =
        refreshTokenRepository
            .findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("유효하지 않은 리프레시 토큰입니다."));

    if (!refreshToken.isValid()) {
      throw new InvalidTokenException("만료되거나 폐기된 리프레시 토큰입니다.");
    }

    Claims claims;
    try {
      claims = jwtService.parseClaims(request.refreshToken());
    } catch (JwtException ex) {
      throw new InvalidTokenException("유효하지 않은 리프레시 토큰입니다.");
    }

    Long userId = Long.parseLong(claims.getSubject());
    if (!userId.equals(refreshToken.getUserId())) {
      throw new InvalidTokenException("유효하지 않은 리프레시 토큰입니다.");
    }

    AppUser user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new InvalidTokenException("사용자를 찾을 수 없습니다."));

    refreshToken.revoke();
    refreshTokenRepository.save(refreshToken);

    LoginResponse newTokens = issueTokens(user);
    return new TokenRefreshResponse(
        newTokens.accessToken(),
        newTokens.refreshToken(),
        newTokens.tokenType(),
        newTokens.expiresIn());
  }

  public void logout(LogoutRequest request) {
    String tokenHash = computeTokenHash(request.refreshToken());
    refreshTokenRepository
        .findByTokenHash(tokenHash)
        .ifPresent(
            rt -> {
              rt.revoke();
              refreshTokenRepository.save(rt);
            });
  }

  private LoginResponse issueTokens(AppUser user) {
    String accessToken =
        jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
    String refreshTokenValue = jwtService.generateRefreshToken(user.getId());

    OffsetDateTime expiresAt =
        OffsetDateTime.now().plus(jwtService.getRefreshTokenExpiration(), ChronoUnit.MILLIS);
    RefreshToken refreshToken =
        RefreshToken.create(user.getId(), computeTokenHash(refreshTokenValue), expiresAt);
    refreshTokenRepository.save(refreshToken);

    long expiresInSeconds = jwtService.getAccessTokenExpiration() / 1000;
    LoginResponse.UserInfo userInfo =
        new LoginResponse.UserInfo(
            user.getId(), user.getEmail(), user.getName(), user.getRole().name());
    return new LoginResponse(accessToken, refreshTokenValue, "Bearer", expiresInSeconds, userInfo);
  }

  private String computeTokenHash(String token) {
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashBytes = digest.digest(token.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder();
      for (byte b : hashBytes) {
        hex.append(String.format("%02x", b));
      }
      return hex.toString();
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException("SHA-256 algorithm not available", ex);
    }
  }
}
