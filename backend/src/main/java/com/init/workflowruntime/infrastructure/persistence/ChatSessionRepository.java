package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** ChatSession 엔티티에 대한 JpaRepository 인터페이스입니다. 인프라 계층에서 관리하며 타입 안정성을 위해 Enum 기반 조회를 지원합니다. */
@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
  /**
   * 특정 상태의 세션들을 시작 시각 내림차순으로 조회합니다.
   *
   * @param status 조회할 세션 상태 (Enum)
   * @return 세션 목록
   */
  List<ChatSession> findByStatusOrderByStartedAtDesc(ChatSessionStatus status);
}
