package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
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
  Page<ChatSession> findByWorkspaceId(Long workspaceId, Pageable pageable);

  @Override
  Page<ChatSession> findByWorkspaceIdAndStatus(
      Long workspaceId, ChatSessionStatus status, Pageable pageable);

  @Override
  Page<ChatSession> findByStatus(ChatSessionStatus status, Pageable pageable);

  @Override
  @Query(
      value =
          """
          SELECT cs.*
          FROM runtime.chat_session cs
          WHERE cs.workspace_id = :workspaceId
            AND (:status IS NULL OR cs.status = :status)
            AND (:assignedCounselorId IS NULL OR cs.assigned_counselor_id = :assignedCounselorId)
            AND (:startedFrom IS NULL OR cs.started_at >= :startedFrom)
            AND (:startedBefore IS NULL OR cs.started_at < :startedBefore)
            AND (
              :keyword IS NULL
              OR LOWER(cs.channel) LIKE CONCAT('%', :keyword, '%')
              OR LOWER(CAST(cs.meta_json AS text)) LIKE CONCAT('%', :keyword, '%')
              OR EXISTS (
                SELECT 1
                FROM runtime.chat_message cm
                WHERE cm.chat_session_id = cs.id
                  AND LOWER(COALESCE(cm.content, '')) LIKE CONCAT('%', :keyword, '%')
              )
            )
          ORDER BY cs.started_at DESC, cs.id DESC
          """,
      countQuery =
          """
          SELECT COUNT(*)
          FROM runtime.chat_session cs
          WHERE cs.workspace_id = :workspaceId
            AND (:status IS NULL OR cs.status = :status)
            AND (:assignedCounselorId IS NULL OR cs.assigned_counselor_id = :assignedCounselorId)
            AND (:startedFrom IS NULL OR cs.started_at >= :startedFrom)
            AND (:startedBefore IS NULL OR cs.started_at < :startedBefore)
            AND (
              :keyword IS NULL
              OR LOWER(cs.channel) LIKE CONCAT('%', :keyword, '%')
              OR LOWER(CAST(cs.meta_json AS text)) LIKE CONCAT('%', :keyword, '%')
              OR EXISTS (
                SELECT 1
                FROM runtime.chat_message cm
                WHERE cm.chat_session_id = cs.id
                  AND LOWER(COALESCE(cm.content, '')) LIKE CONCAT('%', :keyword, '%')
              )
            )
          """,
      nativeQuery = true)
  Page<ChatSession> searchByWorkspace(
      @Param("workspaceId") Long workspaceId,
      @Param("status") String status,
      @Param("keyword") String keyword,
      @Param("startedFrom") OffsetDateTime startedFrom,
      @Param("startedBefore") OffsetDateTime startedBefore,
      @Param("assignedCounselorId") Long assignedCounselorId,
      Pageable pageable);
}
