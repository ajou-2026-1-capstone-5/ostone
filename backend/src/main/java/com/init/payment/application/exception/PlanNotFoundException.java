package com.init.payment.application.exception;

import com.init.shared.application.exception.NotFoundException;

public class PlanNotFoundException extends NotFoundException {
  public PlanNotFoundException(String planKey) {
    super("PLAN_NOT_FOUND", "요금제를 찾을 수 없습니다. planKey=" + planKey);
  }
}
