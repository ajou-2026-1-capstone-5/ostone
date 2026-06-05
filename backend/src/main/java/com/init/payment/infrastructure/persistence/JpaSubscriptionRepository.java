package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.Subscription;
import com.init.payment.domain.model.SubscriptionStatus;
import com.init.payment.domain.repository.SubscriptionRepository;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaSubscriptionRepository
    extends JpaRepository<Subscription, Long>, SubscriptionRepository {

  @Override
  default Optional<Subscription> findCurrentByWorkspaceId(Long workspaceId) {
    return findFirstByWorkspaceIdAndStatusNotOrderByIdDesc(
        workspaceId, SubscriptionStatus.CANCELED);
  }

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select s from Subscription s where s.id = :id")
  Optional<Subscription> findByIdForUpdate(@Param("id") Long id);

  @Override
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query(
      """
      select s
      from Subscription s
      where s.workspaceId = :workspaceId
        and s.status <> com.init.payment.domain.model.SubscriptionStatus.CANCELED
      order by s.id desc
      """)
  Optional<Subscription> findCurrentByWorkspaceIdForUpdate(@Param("workspaceId") Long workspaceId);

  @Override
  default List<Subscription> findChargeable(OffsetDateTime now) {
    return findByStatusAndCancelAtPeriodEndFalseAndCurrentPeriodEndLessThanEqual(
        SubscriptionStatus.ACTIVE, now);
  }

  @Override
  default List<Subscription> findExpiringCancellations(OffsetDateTime now) {
    return findByStatusAndCancelAtPeriodEndTrueAndCurrentPeriodEndLessThanEqual(
        SubscriptionStatus.ACTIVE, now);
  }

  @Override
  default List<Subscription> findRetryDue(OffsetDateTime now) {
    return findByStatusAndNextRetryAtLessThanEqual(SubscriptionStatus.PAST_DUE, now);
  }

  Optional<Subscription> findFirstByWorkspaceIdAndStatusNotOrderByIdDesc(
      Long workspaceId, SubscriptionStatus status);

  List<Subscription> findByStatusAndCancelAtPeriodEndFalseAndCurrentPeriodEndLessThanEqual(
      SubscriptionStatus status, OffsetDateTime currentPeriodEnd);

  List<Subscription> findByStatusAndCancelAtPeriodEndTrueAndCurrentPeriodEndLessThanEqual(
      SubscriptionStatus status, OffsetDateTime currentPeriodEnd);

  List<Subscription> findByStatusAndNextRetryAtLessThanEqual(
      SubscriptionStatus status, OffsetDateTime nextRetryAt);
}
