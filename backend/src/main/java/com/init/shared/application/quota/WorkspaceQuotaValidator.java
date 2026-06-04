package com.init.shared.application.quota;

public interface WorkspaceQuotaValidator {

  void assertDatasetUploadAllowed(Long workspaceId);

  /** 도메인팩 생성·검토 시간당 한도 강제(롤링 1시간 윈도우). 생성과 검토가 단일 예산을 공유한다. */
  void assertPipelineRunAllowed(Long workspaceId);

  /** 워크스페이스 멤버 추가 한도 강제. 멤버 저장 직전 호출한다. */
  void assertMemberAddAllowed(Long workspaceId);
}
