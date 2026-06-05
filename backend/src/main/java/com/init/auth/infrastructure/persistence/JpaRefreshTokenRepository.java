package com.init.auth.infrastructure.persistence;

import com.init.auth.domain.model.RefreshToken;
import com.init.auth.domain.repository.RefreshTokenRepository;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaRefreshTokenRepository
    extends JpaRepository<RefreshToken, Long>, RefreshTokenRepository {

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select token from RefreshToken token where token.tokenHash = :tokenHash")
  Optional<RefreshToken> findByTokenHashForUpdate(@Param("tokenHash") String tokenHash);

  @Override
  @Modifying
  @Query(
      """
      update RefreshToken token
         set token.revokedAt = :revokedAt
       where token.userId = :userId
         and token.revokedAt is null
      """)
  int revokeAllByUserId(@Param("userId") Long userId, @Param("revokedAt") OffsetDateTime revokedAt);
}
