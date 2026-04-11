package com.init.domainpack.domain.model;

import java.util.Locale;

public enum RiskLevel {
  LOW,
  MEDIUM,
  HIGH,
  CRITICAL;

  public static String normalize(String riskLevel) {
    return valueOf(riskLevel.trim().toUpperCase(Locale.ROOT)).name();
  }
}
