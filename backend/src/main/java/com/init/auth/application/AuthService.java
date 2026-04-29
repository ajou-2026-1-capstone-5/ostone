package com.init.auth.application;

import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.application.exception.InvalidCredentialsException;
import com.init.auth.application.exception.InvalidTokenException;
import com.init.auth.application.exception.PasswordResetRequiredException;
import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.RefreshToken;
import com.init.auth.domain.model.UserStatus;
import com.init.auth.domain.repository.AppUserRepository;
import com.init.auth.domain.repository.RefreshTokenRepository;
import com.init.shared.application.TokenHasher;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class AuthService {

  private final AppUserRepository userRepository;
  private final RefreshTokenRepository refreshTokenRepository;
  private final JwtService jwtService;
  private final PasswordEncoder passwordEncoder;
  private final TokenHasher tokenHasher;
  private final String dummyHash;

  public AuthService(
      AppUserRepository userRepository,
      RefreshTokenRepository refreshTokenRepository,
      JwtService jwtService,
      PasswordEncoder passwordEncoder,
      TokenHasher tokenHasher) {
    this.userRepository = userRepository;
    this.refreshTokenRepository = refreshTokenRepository;
    this.jwtService = jwtService;
    this.passwordEncoder = passwordEncoder;
    this.tokenHasher = tokenHasher;
    this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
  }

  @Transactional(noRollbackFor = PasswordResetRequiredException.class)
  public LoginResult login(LoginCommand command) {
    Optional<AppUser> userOpt = userRepository.findByEmail(command.email());

    String hashToCompare = userOpt.map(AppUser::getPasswordHash).orElse(dummyHash);
    boolean passwordMatches = passwordEncoder.matches(command.password(), hashToCompare);

    AppUser user =
        userOpt.orElseThrow(() -> new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다."));

    if (!passwordMatches) {
      throw new InvalidCredentialsException("이메일 또는 비밀번호가 올바르지 않습니다.");
    }

    if (user.getStatus() != UserStatus.ACTIVE) {
      throw new InvalidCredentialsException("비활성화된 계정입니다.");
    }

    if (user.isPasswordResetRequired()) {
      String rawToken = UUID.randomUUID().toString();
      String tokenHash = tokenHasher.hash(rawToken);
      OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(30);
      user.initiatePasswordReset(tokenHash, expiresAt);
      userRepository.save(user);
      throw new PasswordResetRequiredException("비밀번호 재설정이 필요합니다.", rawToken);
    }

    return issueTokens(user);
  }

  @Transactional
  public SignupResult signup(SignupCommand command) {
    if (userRepository.existsByEmail(command.email())) {
      throw new EmailAlreadyExistsException("이미 사용 중인 이메일입니다.");
    }

    AppUser user =
        AppUser.create(command.name(), command.email(), passwordEncoder.encode(command.password()));
    try {
      AppUser saved = userRepository.save(user);
      return new SignupResult(saved.getId(), saved.getEmail(), saved.getName());
    } catch (DataIntegrityViolationException ex) {
      throw new EmailAlreadyExistsException("이미 사용 중인 이메일입니다.");
    }
  }

  @Transactional
  public TokenRefreshResult refresh(TokenRefreshCommand command) {
    String tokenHash = tokenHasher.hash(command.refreshToken());

    RefreshToken refreshToken =
        refreshTokenRepository
            .findByTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("유효하지 않은 리프레시 토큰입니다."));

    if (!refreshToken.isValid()) {
      throw new InvalidTokenException("만료되거나 폐기된 리프레시 토큰입니다.");
    }

    Long userId;
    try {
      Claims claims = jwtService.parseClaims(command.refreshToken());
      if (!"refresh".equals(claims.get("type", String.class))) {
        throw new InvalidTokenException("유효하지 않은 리프레시 토큰입니다.");
      }
      userId = Long.parseLong(claims.getSubject());
    } catch (JwtException | NumberFormatException ex) {
      throw new InvalidTokenException("유효하지 않은 리프레시 토큰입니다.");
    }
    if (!userId.equals(refreshToken.getUserId())) {
      throw new InvalidTokenException("유효하지 않은 리프레시 토큰입니다.");
    }

    AppUser user =
        userRepository
            .findById(userId)
            .orElseThrow(() -> new InvalidTokenException("사용자를 찾을 수 없습니다."));

    if (user.getStatus() != UserStatus.ACTIVE) {
      throw new InvalidTokenException("비활성화된 계정입니다.");
    }
    if (user.isPasswordResetRequired()) {
      throw new InvalidTokenException("비밀번호 재설정이 필요합니다.");
    }

    refreshToken.revoke();
    refreshTokenRepository.save(refreshToken);

    LoginResult newTokens = issueTokens(user);
    return new TokenRefreshResult(
        newTokens.accessToken(),
        newTokens.refreshToken(),
        newTokens.tokenType(),
        newTokens.expiresIn());
  }

  @Transactional
  public void logout(LogoutCommand command) {
    String tokenHash = tokenHasher.hash(command.refreshToken());
    refreshTokenRepository
        .findByTokenHash(tokenHash)
        .ifPresent(
            rt -> {
              rt.revoke();
              refreshTokenRepository.save(rt);
            });
  }

  @Transactional
  public PasswordResetInitResult passwordResetInit(PasswordResetInitCommand command) {
    String rawToken = UUID.randomUUID().toString();
    String tokenHash = tokenHasher.hash(rawToken);
    OffsetDateTime expiresAt = OffsetDateTime.now().plusMinutes(30);

    boolean userExists =
        userRepository
            .findByEmail(command.email())
            .map(
                user -> {
                  user.initiatePasswordReset(tokenHash, expiresAt);
                  userRepository.save(user);
                  return true;
                })
            .orElse(false);

    return new PasswordResetInitResult(userExists, userExists ? rawToken : null);
  }

  @Transactional
  public void passwordResetComplete(PasswordResetCompleteCommand command) {
    String tokenHash = tokenHasher.hash(command.resetToken());

    AppUser user =
        userRepository
            .findByPasswordResetTokenHash(tokenHash)
            .orElseThrow(() -> new InvalidTokenException("유효하지 않은 비밀번호 재설정 토큰입니다."));

    if (!user.isPasswordResetTokenValid()) {
      throw new InvalidTokenException("만료된 비밀번호 재설정 토큰입니다.");
    }

    user.completePasswordReset(passwordEncoder.encode(command.newPassword()));
    userRepository.save(user);
  }

  private LoginResult issueTokens(AppUser user) {
    String accessToken =
        jwtService.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
    String refreshTokenValue = jwtService.generateRefreshToken(user.getId());

    OffsetDateTime expiresAt =
        OffsetDateTime.now().plus(jwtService.getRefreshTokenExpiration(), ChronoUnit.MILLIS);
    RefreshToken refreshToken =
        RefreshToken.create(user.getId(), tokenHasher.hash(refreshTokenValue), expiresAt);
    refreshTokenRepository.save(refreshToken);

    long expiresInSeconds = jwtService.getAccessTokenExpiration() / 1000;
    return new LoginResult(
        accessToken,
        refreshTokenValue,
        "Bearer",
        expiresInSeconds,
        user.getId(),
        user.getEmail(),
        user.getName(),
        user.getRole().name());
  }
}
