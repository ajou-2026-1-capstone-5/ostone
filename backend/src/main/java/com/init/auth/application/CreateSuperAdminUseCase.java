package com.init.auth.application;

import com.init.auth.application.exception.EmailAlreadyExistsException;
import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.repository.AppUserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class CreateSuperAdminUseCase {

  private final AppUserRepository userRepository;
  private final PasswordEncoder passwordEncoder;

  public CreateSuperAdminUseCase(
      AppUserRepository userRepository, PasswordEncoder passwordEncoder) {
    this.userRepository = userRepository;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public CreateSuperAdminResult execute(CreateSuperAdminCommand command) {
    if (userRepository.existsByEmail(command.email())) {
      throw new EmailAlreadyExistsException("이미 사용 중인 이메일입니다.");
    }

    AppUser user =
        AppUser.createSuperAdmin(
            command.name(), command.email(), passwordEncoder.encode(command.password()));
    try {
      AppUser saved = userRepository.save(user);
      return new CreateSuperAdminResult(
          saved.getId(), saved.getEmail(), saved.getName(), saved.getRole().name());
    } catch (DataIntegrityViolationException ex) {
      throw new EmailAlreadyExistsException("이미 사용 중인 이메일입니다.");
    }
  }
}
