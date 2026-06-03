package com.init.payment.application;

import java.time.OffsetDateTime;
import java.util.Optional;

public interface WorkspaceQuotaQueryPort {

  Optional<WorkspaceQuota> findCurrentQuota(Long workspaceId, OffsetDateTime at);

  boolean hasFreeOnboardingAllowance(Long workspaceId);
}
