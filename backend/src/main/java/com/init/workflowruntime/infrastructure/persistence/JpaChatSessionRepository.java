package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import jakarta.persistence.LockModeType;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

/** ChatSession의 Spring Data JPA repository입니다. */
@Repository
public interface JpaChatSessionRepository extends JpaRepository<ChatSession, Long> {

  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select cs from ChatSession cs where cs.id = :id")
  Optional<ChatSession> findByIdForUpdate(@Param("id") Long id);

  @Query(
      """
      select cs
      from ChatSession cs
      where cs.status = :status
        and cs.channel <> 'SIMULATION'
      order by cs.startedAt desc
      """)
  List<ChatSession> findByStatusOrderByStartedAtDesc(@Param("status") ChatSessionStatus status);

  @Query(
      """
      select cs
      from ChatSession cs
      where cs.status in :statuses
        and cs.channel <> 'SIMULATION'
      order by cs.startedAt desc
      """)
  List<ChatSession> findByStatusInOrderByStartedAtDesc(
      @Param("statuses") Collection<ChatSessionStatus> statuses);

  @Query(
      """
      select cs
      from ChatSession cs
      where cs.workspaceId = :workspaceId
        and cs.status in :statuses
        and cs.channel <> 'SIMULATION'
      order by cs.startedAt desc
      """)
  List<ChatSession> findByWorkspaceIdAndStatusInOrderByStartedAtDesc(
      @Param("workspaceId") Long workspaceId,
      @Param("statuses") Collection<ChatSessionStatus> statuses);

  List<ChatSession> findByAssignedCounselorId(Long counselorId);

  Optional<ChatSession>
      findFirstByWorkspaceIdAndStartedByAndStatusInAndChannelNotOrderByStartedAtDescIdDesc(
          Long workspaceId,
          Long startedBy,
          Collection<ChatSessionStatus> statuses,
          String excludedChannel);

  Page<ChatSession> findByWorkspaceId(Long workspaceId, Pageable pageable);

  @Query(
      """
      select cs
      from ChatSession cs
      where cs.workspaceId = :workspaceId
        and cs.status = :status
        and cs.channel <> 'SIMULATION'
      """)
  Page<ChatSession> findByWorkspaceIdAndStatus(
      @Param("workspaceId") Long workspaceId,
      @Param("status") ChatSessionStatus status,
      Pageable pageable);

  Page<ChatSession> findByWorkspaceIdAndChannelOrderByStartedAtDesc(
      Long workspaceId, String channel, Pageable pageable);

  @Query(
      """
      select cs
      from ChatSession cs
      where cs.status = :status
        and cs.channel <> 'SIMULATION'
      """)
  Page<ChatSession> findByStatus(@Param("status") ChatSessionStatus status, Pageable pageable);

  @Query(
      value =
          """
          SELECT cs.*
          FROM runtime.chat_session cs
          WHERE cs.workspace_id = :workspaceId
            AND cs.channel <> 'SIMULATION'
            AND (:status IS NULL OR cs.status = :status)
            AND (:assignedCounselorId IS NULL OR cs.assigned_counselor_id = :assignedCounselorId)
            AND (:startedFrom IS NULL OR cs.started_at >= :startedFrom)
            AND (:startedBefore IS NULL OR cs.started_at < :startedBefore)
            AND (
              :keyword IS NULL
              OR LOWER(cs.channel) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
              OR LOWER(CAST(cs.meta_json AS text)) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
              OR EXISTS (
                SELECT 1
                FROM runtime.chat_message cm
                WHERE cm.chat_session_id = cs.id
                  AND LOWER(COALESCE(cm.content, '')) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
              )
            )
          ORDER BY cs.started_at DESC, cs.id DESC
          """,
      countQuery =
          """
          SELECT COUNT(*)
          FROM runtime.chat_session cs
          WHERE cs.workspace_id = :workspaceId
            AND cs.channel <> 'SIMULATION'
            AND (:status IS NULL OR cs.status = :status)
            AND (:assignedCounselorId IS NULL OR cs.assigned_counselor_id = :assignedCounselorId)
            AND (:startedFrom IS NULL OR cs.started_at >= :startedFrom)
            AND (:startedBefore IS NULL OR cs.started_at < :startedBefore)
            AND (
              :keyword IS NULL
              OR LOWER(cs.channel) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
              OR LOWER(CAST(cs.meta_json AS text)) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
              OR EXISTS (
                SELECT 1
                FROM runtime.chat_message cm
                WHERE cm.chat_session_id = cs.id
                  AND LOWER(COALESCE(cm.content, '')) LIKE CONCAT('%', :keyword, '%') ESCAPE '\\'
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
