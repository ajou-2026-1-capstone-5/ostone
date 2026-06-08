package com.init.auth.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.UserRole;
import com.init.auth.domain.repository.AppUserRepository;
import com.init.testsupport.PersistenceTestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
@DisplayName("CreateSuperAdminUseCase")
class CreateSuperAdminUseCaseTest {

  @Mock private AppUserRepository userRepository;
  @Mock private PasswordEncoder passwordEncoder;

  private CreateSuperAdminUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new CreateSuperAdminUseCase(userRepository, passwordEncoder);
  }

  @Test
  @DisplayName("execute: 신규 이메일 → SUPER_ADMIN 계정 생성")
  void should_SUPER_ADMIN계정생성_when_신규이메일() {
    // given
    CreateSuperAdminCommand command =
        new CreateSuperAdminCommand("운영 관리자", "super@example.com", "password123");
    given(userRepository.existsByEmail("super@example.com")).willReturn(false);
    given(passwordEncoder.encode("password123")).willReturn("$2a$10$hashedpassword");

    AppUser savedUser =
        AppUser.createSuperAdmin("운영 관리자", "super@example.com", "$2a$10$hashedpassword");
    PersistenceTestFixtures.assignGeneratedId(savedUser, 10L);
    given(userRepository.save(any(AppUser.class))).willReturn(savedUser);

    // when
    CreateSuperAdminResult result = useCase.execute(command);

    // then
    assertThat(result.id()).isEqualTo(10L);
    assertThat(result.email()).isEqualTo("super@example.com");
    assertThat(result.name()).isEqualTo("운영 관리자");
    assertThat(result.role()).isEqualTo(UserRole.SUPER_ADMIN.name());
  }

  @Test
  @DisplayName("execute: 중복 이메일 → EmailAlreadyExistsException 발생")
  void should_이메일중복예외발생_when_중복이메일() {
    // given
    CreateSuperAdminCommand command =
        new CreateSuperAdminCommand("운영 관리자", "super@example.com", "password123");
    given(userRepository.existsByEmail("super@example.com")).willReturn(true);

    // when & then
    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(EmailAlreadyExistsException.class)
        .hasMessageContaining("이미 사용 중인 이메일입니다.");
    verify(userRepository, never()).save(any());
  }

  @Test
  @DisplayName("execute: 저장 중 unique constraint 충돌 → EmailAlreadyExistsException 발생")
  void should_이메일중복예외발생_when_저장중충돌() {
    // given
    CreateSuperAdminCommand command =
        new CreateSuperAdminCommand("운영 관리자", "super@example.com", "password123");
    given(userRepository.existsByEmail("super@example.com")).willReturn(false);
    given(passwordEncoder.encode("password123")).willReturn("$2a$10$hashedpassword");
    given(userRepository.save(any(AppUser.class))).willThrow(DataIntegrityViolationException.class);

    // when & then
    assertThatThrownBy(() -> useCase.execute(command))
        .isInstanceOf(EmailAlreadyExistsException.class)
        .hasMessageContaining("이미 사용 중인 이메일입니다.");
  }
}
