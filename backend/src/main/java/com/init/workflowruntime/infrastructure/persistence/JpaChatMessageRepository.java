package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.stereotype.Repository;

/** ChatMessageRepository의 JPA 구현체입니다. Spring Data JPA의 프록시 메커니즘을 통해 도메인 포트 인터페이스를 자동으로 구현합니다. */
@Repository
public interface JpaChatMessageRepository
    extends JpaRepository<ChatMessage, Long>, ChatMessageRepository {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Override
  Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);
}
