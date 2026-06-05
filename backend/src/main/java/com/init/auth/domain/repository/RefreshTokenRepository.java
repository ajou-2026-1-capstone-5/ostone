package com.init.auth.domain.repository;

import com.init.auth.domain.model.RefreshToken;
import java.time.OffsetDateTime;
import java.util.Optional;

public interface RefreshTokenRepository {

  RefreshToken save(RefreshToken token);

  Optional<RefreshToken> findByTokenHash(String tokenHash);

  Optional<RefreshToken> findByTokenHashForUpdate(String tokenHash);

  int revokeAllByUserId(Long userId, OffsetDateTime revokedAt);
}
