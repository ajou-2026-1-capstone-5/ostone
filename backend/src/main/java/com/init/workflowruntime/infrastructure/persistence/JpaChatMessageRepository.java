package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatMessage;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

/** ChatMessage의 Spring Data JPA repository입니다. */
@Repository
public interface JpaChatMessageRepository extends JpaRepository<ChatMessage, Long> {

  List<ChatMessage> findByChatSessionIdOrderBySeqNoAsc(Long chatSessionId);

  Page<ChatMessage> findByChatSessionIdOrderBySeqNoDesc(Long chatSessionId, Pageable pageable);

  List<ChatMessage> findTop5ByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);
}
