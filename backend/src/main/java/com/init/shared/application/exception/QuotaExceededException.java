package com.init.shared.application.exception;

public class QuotaExceededException extends BusinessException {

  private final String resource;
  private final int limit;
  private final long used;

  public QuotaExceededException(String resource, int limit, long used) {
    super("QUOTA_EXCEEDED", "워크스페이스 사용량 한도를 초과했습니다.");
    this.resource = resource;
    this.limit = limit;
    this.used = used;
  }

  public String getResource() {
    return resource;
  }

  public int getLimit() {
    return limit;
  }

  public long getUsed() {
    return used;
  }
}
