package com.init.auth.infrastructure.persistence;

import com.init.auth.domain.model.RefreshToken;
import com.init.auth.domain.repository.RefreshTokenRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaRefreshTokenRepository
    extends JpaRepository<RefreshToken, Long>, RefreshTokenRepository {}
