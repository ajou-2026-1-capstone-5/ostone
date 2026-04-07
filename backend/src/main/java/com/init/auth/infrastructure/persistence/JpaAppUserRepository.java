package com.init.auth.infrastructure.persistence;

import com.init.auth.domain.model.AppUser;
import com.init.auth.domain.repository.AppUserRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaAppUserRepository extends JpaRepository<AppUser, Long>, AppUserRepository {}
