package com.init.shared.infrastructure.persistence;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

public final class NativeQueryColumnConverter {

  private NativeQueryColumnConverter() {}

  public static Long toLong(Object value) {
    return value instanceof Number number ? number.longValue() : null;
  }

  public static OffsetDateTime toOffsetDateTime(Object value) {
    if (value == null) {
      return null;
    }
    if (value instanceof OffsetDateTime offsetDateTime) {
      return offsetDateTime;
    }
    if (value instanceof Instant instant) {
      return OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
    if (value instanceof Timestamp timestamp) {
      return OffsetDateTime.ofInstant(timestamp.toInstant(), ZoneOffset.UTC);
    }
    if (value instanceof LocalDateTime localDateTime) {
      return localDateTime.atOffset(ZoneOffset.UTC);
    }
    throw new IllegalArgumentException(
        "Unsupported timestamp value: " + value.getClass().getName());
  }
}
