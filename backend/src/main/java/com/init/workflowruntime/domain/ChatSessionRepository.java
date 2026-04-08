package com.init.workflowruntime.domain;

import java.util.List;
import java.util.Optional;

/** 채팅 세션 영속성을 위한 도메인 포트 인터페이스입니다. */
public interface ChatSessionRepository {

  Optional<ChatSession> findById(Long id);

  ChatSession save(ChatSession session);

  List<ChatSession> findByStatusOrderByStartedAtDesc(ChatSessionStatus status);
}
