package com.init.payment.application.gateway;

import java.time.OffsetDateTime;
import org.springframework.lang.Nullable;

public record TossCancelResult(String transactionKey, @Nullable OffsetDateTime canceledAt) {}
