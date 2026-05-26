package com.init.workflowruntime.domain;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** 채팅 세션 영속성을 위한 도메인 포트 인터페이스입니다. */
public interface ChatSessionRepository {

  Optional<ChatSession> findById(Long id);

  Optional<ChatSession> findByIdForUpdate(Long id);

  ChatSession save(ChatSession session);

  List<ChatSession> findByStatusOrderByStartedAtDesc(ChatSessionStatus status);

  List<ChatSession> findByStatusInOrderByStartedAtDesc(Collection<ChatSessionStatus> statuses);

  List<ChatSession> findByAssignedCounselorId(Long counselorId);

  Page<ChatSession> findByStatus(ChatSessionStatus status, Pageable pageable);

  Page<ChatSession> findAll(Pageable pageable);
}
