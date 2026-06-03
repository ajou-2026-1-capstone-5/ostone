package com.init.auth.domain.repository;

import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.model.UserRole;
import java.util.Optional;

public interface AppUserRepository {

  AppUser save(AppUser user);

  Optional<AppUser> findByEmail(String email);

  Optional<AppUser> findById(Long id);

  boolean existsByEmail(String email);

  boolean existsByRole(UserRole role);

  Optional<AppUser> findByPasswordResetTokenHash(String tokenHash);
}
