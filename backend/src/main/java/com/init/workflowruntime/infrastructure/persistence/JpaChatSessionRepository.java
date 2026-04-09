package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/** ChatSessionRepository의 JPA 구현체입니다. Spring Data JPA의 프록시 메커니즘을 통해 도메인 포트 인터페이스를 자동으로 구현합니다. */
@Repository
public interface JpaChatSessionRepository
    extends JpaRepository<ChatSession, Long>, ChatSessionRepository {}
