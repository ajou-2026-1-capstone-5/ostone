package com.init.auth.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.init.auth.application.exception.InvalidTokenException;
import com.init.shared.infrastructure.Sha256TokenHasher;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers(disabledWithoutDocker = true)
@Import({
  AuthService.class,
  JwtService.class,
  Sha256TokenHasher.class,
  AuthServiceConcurrencyTest.PasswordEncoderTestConfig.class
})
@DisplayName("AuthService refresh concurrency")
class AuthServiceConcurrencyTest {

  @Container static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16");

  static {
    postgres.start();
  }

  @DynamicPropertySource
  static void configureDataSource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", postgres::getJdbcUrl);
    registry.add("spring.datasource.username", postgres::getUsername);
    registry.add("spring.datasource.password", postgres::getPassword);
    registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    registry.add("spring.jpa.hibernate.ddl-auto", () -> "create");
    registry.add(
        "spring.jpa.properties.hibernate.dialect", () -> "org.hibernate.dialect.PostgreSQLDialect");
    registry.add("spring.jpa.properties.hibernate.hbm2ddl.create_namespaces", () -> "true");
    registry.add("spring.liquibase.enabled", () -> "false");
  }

  @Autowired private AuthService authService;

  @Test
  @Transactional(propagation = Propagation.NOT_SUPPORTED)
  @DisplayName("refresh: 같은 리프레시 토큰 동시 rotation → 하나만 성공하고 나머지는 InvalidTokenException")
  void shouldAllowOnlyOneRefreshWhenSameRefreshTokenRotatedConcurrently() throws Exception {
    // given
    String email = "concurrent-refresh@example.com";
    String password = "password123";
    authService.signup(new SignupCommand("동시성 사용자", email, password));
    LoginResult loginResult = authService.login(new LoginCommand(email, password));
    TokenRefreshCommand command = new TokenRefreshCommand(loginResult.refreshToken());

    CountDownLatch ready = new CountDownLatch(2);
    CountDownLatch start = new CountDownLatch(1);
    ExecutorService executor = Executors.newFixedThreadPool(2);

    try {
      List<Future<RefreshAttempt>> futures =
          List.of(
              executor.submit(refreshAttempt(command, ready, start)),
              executor.submit(refreshAttempt(command, ready, start)));

      assertThat(ready.await(5, TimeUnit.SECONDS)).isTrue();
      start.countDown();

      List<RefreshAttempt> attempts =
          futures.stream().map(AuthServiceConcurrencyTest::getRefreshAttempt).toList();

      assertThat(attempts).hasSize(2);
      assertThat(attempts.stream().filter(RefreshAttempt::succeeded).count())
          .describedAs("attempts=%s", attempts)
          .isEqualTo(1);
      assertThat(attempts.stream().filter(RefreshAttempt::failedWithInvalidToken).count())
          .describedAs("attempts=%s", attempts)
          .isEqualTo(1);
    } finally {
      executor.shutdownNow();
    }
  }

  private Callable<RefreshAttempt> refreshAttempt(
      TokenRefreshCommand command, CountDownLatch ready, CountDownLatch start) {
    return () -> {
      ready.countDown();
      if (!start.await(5, TimeUnit.SECONDS)) {
        throw new IllegalStateException("refresh attempts were not released");
      }

      try {
        return RefreshAttempt.success(authService.refresh(command));
      } catch (RuntimeException ex) {
        return RefreshAttempt.failure(ex);
      }
    };
  }

  private static RefreshAttempt getRefreshAttempt(Future<RefreshAttempt> future) {
    try {
      return future.get(10, TimeUnit.SECONDS);
    } catch (Exception ex) {
      throw new IllegalStateException("refresh attempt did not finish", ex);
    }
  }

  private record RefreshAttempt(TokenRefreshResult result, Throwable failure) {
    static RefreshAttempt success(TokenRefreshResult result) {
      return new RefreshAttempt(result, null);
    }

    static RefreshAttempt failure(Throwable failure) {
      return new RefreshAttempt(null, failure);
    }

    boolean succeeded() {
      return result != null && failure == null;
    }

    boolean failedWithInvalidToken() {
      return failure instanceof InvalidTokenException;
    }
  }

  @TestConfiguration
  static class PasswordEncoderTestConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
      return new BCryptPasswordEncoder();
    }
  }
}
