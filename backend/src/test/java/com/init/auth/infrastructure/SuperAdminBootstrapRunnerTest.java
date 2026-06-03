package com.init.auth.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.UserRole;
import com.init.auth.domain.repository.AppUserRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@DisplayName("SuperAdminBootstrapRunner")
class SuperAdminBootstrapRunnerTest {

  @Mock private AppUserRepository userRepository;
  @Mock private PasswordEncoder passwordEncoder;

  @Test
  @DisplayName("run: 부트스트랩 env 없음 → 아무 작업도 하지 않음")
  void should_skip_when_env비어있음() {
    // given
    SuperAdminBootstrapRunner runner =
        new SuperAdminBootstrapRunner(userRepository, passwordEncoder, "", "Super Admin", "");

    // when
    runner.run(null);

    // then
    verifyNoInteractions(userRepository, passwordEncoder);
  }

  @Test
  @DisplayName("run: SUPER_ADMIN 없음 + env 설정됨 → 최초 SUPER_ADMIN 생성")
  void should_createInitialSuperAdmin_when_env설정되고슈퍼관리자없음() {
    // given
    SuperAdminBootstrapRunner runner =
        new SuperAdminBootstrapRunner(
            userRepository, passwordEncoder, " root@example.com ", " Root Admin ", "password123");
    given(userRepository.existsByRole(UserRole.SUPER_ADMIN)).willReturn(false);
    given(userRepository.existsByEmail("root@example.com")).willReturn(false);
    given(passwordEncoder.encode("password123")).willReturn("$2a$10$hashedpassword");

    // when
    runner.run(null);

    // then
    ArgumentCaptor<AppUser> userCaptor = ArgumentCaptor.forClass(AppUser.class);
    verify(userRepository).save(userCaptor.capture());
    AppUser savedUser = userCaptor.getValue();
    assertThat(savedUser.getEmail()).isEqualTo("root@example.com");
    assertThat(savedUser.getName()).isEqualTo("Root Admin");
    assertThat(savedUser.getPasswordHash()).isEqualTo("$2a$10$hashedpassword");
    assertThat(savedUser.getRole()).isEqualTo(UserRole.SUPER_ADMIN);
  }

  @Test
  @DisplayName("run: 기존 SUPER_ADMIN 있음 → 생성하지 않음")
  void should_skip_when_슈퍼관리자이미있음() {
    // given
    SuperAdminBootstrapRunner runner =
        new SuperAdminBootstrapRunner(
            userRepository, passwordEncoder, "root@example.com", "Root Admin", "password123");
    given(userRepository.existsByRole(UserRole.SUPER_ADMIN)).willReturn(true);

    // when
    runner.run(null);

    // then
    verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verifyNoInteractions(passwordEncoder);
  }

  @Test
  @DisplayName("run: 부트스트랩 비밀번호가 72 UTF-8 bytes 초과 → 생성하지 않음")
  void should_skip_when_비밀번호가72바이트초과() {
    // given
    SuperAdminBootstrapRunner runner =
        new SuperAdminBootstrapRunner(
            userRepository, passwordEncoder, "root@example.com", "Root Admin", "가".repeat(25));
    given(userRepository.existsByRole(UserRole.SUPER_ADMIN)).willReturn(false);

    // when
    runner.run(null);

    // then
    verify(userRepository, never()).save(org.mockito.ArgumentMatchers.any());
    verifyNoInteractions(passwordEncoder);
  }
}
