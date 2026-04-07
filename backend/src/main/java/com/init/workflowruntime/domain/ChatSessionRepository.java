package com.init.workflowruntime.domain;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatSessionRepository extends JpaRepository<ChatSession, Long> {
  // OPEN 상태의 세션만 대기열로 가져올 수 있음
  List<ChatSession> findByStatusOrderByStartedAtDesc(String status);
}
