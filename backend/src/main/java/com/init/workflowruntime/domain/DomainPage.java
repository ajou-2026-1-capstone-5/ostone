package com.init.workflowruntime.domain;

import java.util.List;

/** 도메인 계층에서 사용하는 페이지 응답 값입니다. */
public record DomainPage<T>(
    List<T> content, int page, int size, long totalElements, int totalPages) {

  public DomainPage {
    content = List.copyOf(content);
  }
}
