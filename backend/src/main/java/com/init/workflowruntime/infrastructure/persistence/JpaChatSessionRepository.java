package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** ChatSessionRepository의 JPA 구현체입니다. Spring Data JPA의 프록시 메커니즘을 통해 도메인 포트 인터페이스를 자동으로 구현합니다. */
@Repository
public interface JpaChatSessionRepository
    extends JpaRepository<ChatSession, Long>, ChatSessionRepository {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select cs from ChatSession cs where cs.id = :id")
  @Override
  Optional<ChatSession> findByIdForUpdate(@Param("id") Long id);

  @Override
  List<ChatSession> findByAssignedCounselorId(Long counselorId);

  @Override
  Page<ChatSession> findByStatus(ChatSessionStatus status, Pageable pageable);
}
