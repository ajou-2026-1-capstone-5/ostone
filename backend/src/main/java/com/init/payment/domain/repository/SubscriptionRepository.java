package com.init.payment.domain.repository;

import com.init.payment.domain.model.Subscription;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface SubscriptionRepository {

  Subscription save(Subscription subscription);

  Optional<Subscription> findById(Long id);

  /** 워크스페이스의 현재(미해지) 구독. 워크스페이스당 활성 구독은 1개 (U-010). */
  Optional<Subscription> findCurrentByWorkspaceId(Long workspaceId);

  /** 정기결제 대상: ACTIVE, 기간 만료, 기간말 해지 예약 없음. */
  List<Subscription> findChargeable(OffsetDateTime now);

  /** 기간말 해지 대상: ACTIVE, 기간 만료, 기간말 해지 예약됨 (U-005). */
  List<Subscription> findExpiringCancellations(OffsetDateTime now);

  /** 재시도 대상: PAST_DUE, 재시도 시각 도래 (U-004). */
  List<Subscription> findRetryDue(OffsetDateTime now);
}
