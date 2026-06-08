package com.init.auth.infrastructure;

import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.UserRole;
import com.init.auth.domain.repository.AppUserRepository;
import java.nio.charset.StandardCharsets;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

// env/secret 기반 운영 SUPER_ADMIN 을 먼저 생성하도록 DemoAccountSeedRunner(-50)보다 앞선 순서로 고정한다.
// 데모 SUPER_ADMIN 이 먼저 들어가면 existsByRole 가드에 걸려 운영 계정이 누락되므로, 둘의 공존을 위해 순서가 중요하다.
@Component
@Order(Ordered.LOWEST_PRECEDENCE - 60)
public class SuperAdminBootstrapRunner implements ApplicationRunner {

  private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrapRunner.class);
  private static final int MIN_PASSWORD_BYTES = 8;
  private static final int MAX_BCRYPT_PASSWORD_BYTES = 72;

  private final AppUserRepository userRepository;
  private final PasswordEncoder passwordEncoder;
  private final String email;
  private final String name;
  private final String password;

  public SuperAdminBootstrapRunner(
      AppUserRepository userRepository,
      PasswordEncoder passwordEncoder,
      @Value("${super-admin.email:}") String email,
      @Value("${super-admin.name:Super Admin}") String name,
      @Value("${super-admin.password:}") String password) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
    this.email = email;
    this.name = name;
    this.password = password;
  }

  @Override
  @Transactional
  public void run(ApplicationArguments args) {
    if (!hasText(email) || !hasText(password)) {
      return;
    }

    if (userRepository.existsByRole(UserRole.SUPER_ADMIN)) {
      return;
    }

    if (!isPasswordByteLengthValid(password)) {
      log.warn(
          "SUPER_ADMIN bootstrap skipped: super-admin.password must be {}-{} UTF-8 bytes.",
          MIN_PASSWORD_BYTES,
          MAX_BCRYPT_PASSWORD_BYTES);
      return;
    }

    String normalizedEmail = email.trim();
    if (userRepository.existsByEmail(normalizedEmail)) {
      log.warn("SUPER_ADMIN bootstrap skipped: configured email already exists.");
      return;
    }

    AppUser user =
        AppUser.createSuperAdmin(resolveName(), normalizedEmail, passwordEncoder.encode(password));
    userRepository.save(user);
    log.warn("Initial SUPER_ADMIN account created from environment.");
  }

  private String resolveName() {
    return hasText(name) ? name.trim() : "Super Admin";
  }

  private boolean isPasswordByteLengthValid(String value) {
    int byteLength = value.getBytes(StandardCharsets.UTF_8).length;
    return byteLength >= MIN_PASSWORD_BYTES && byteLength <= MAX_BCRYPT_PASSWORD_BYTES;
  }

  private boolean hasText(String value) {
    return value != null && !value.trim().isEmpty();
  }
}
