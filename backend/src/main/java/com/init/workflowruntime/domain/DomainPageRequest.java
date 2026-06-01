package com.init.workflowruntime.domain;

/** 도메인 계층에서 사용하는 페이지 요청 값입니다. */
public record DomainPageRequest(int page, int size) {
  public DomainPageRequest {
    if (page < 0 || size <= 0) {
      throw new IllegalArgumentException("page must be >= 0 and size must be > 0");
    }
  }
}
