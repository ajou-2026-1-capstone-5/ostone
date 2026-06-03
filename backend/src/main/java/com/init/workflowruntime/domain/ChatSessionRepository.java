package com.init.workflowruntime.domain;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

/** 채팅 세션 영속성을 위한 도메인 포트 인터페이스입니다. */
public interface ChatSessionRepository {

  Optional<ChatSession> findById(Long id);

  Optional<ChatSession> findByIdForUpdate(Long id);

  ChatSession save(ChatSession session);

  List<ChatSession> findByStatusOrderByStartedAtDesc(ChatSessionStatus status);

  List<ChatSession> findByStatusInOrderByStartedAtDesc(Collection<ChatSessionStatus> statuses);

  List<ChatSession> findByWorkspaceIdAndStatusInOrderByStartedAtDesc(
      Long workspaceId, Collection<ChatSessionStatus> statuses);

  List<ChatSession> findByAssignedCounselorId(Long counselorId);

  Optional<ChatSession> findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
      Long workspaceId, Long startedBy, Collection<ChatSessionStatus> statuses);

  DomainPage<ChatSession> findByWorkspaceId(Long workspaceId, DomainPageRequest pageRequest);

  DomainPage<ChatSession> findByWorkspaceIdAndStatus(
      Long workspaceId, ChatSessionStatus status, DomainPageRequest pageRequest);

  DomainPage<ChatSession> findByWorkspaceIdAndChannelOrderByStartedAtDesc(
      Long workspaceId, String channel, DomainPageRequest pageRequest);

  DomainPage<ChatSession> findByStatus(ChatSessionStatus status, DomainPageRequest pageRequest);

  DomainPage<ChatSession> findAll(DomainPageRequest pageRequest);

  DomainPage<ChatSession> searchByWorkspace(
      Long workspaceId,
      String status,
      String keyword,
      OffsetDateTime startedFrom,
      OffsetDateTime startedBefore,
      Long assignedCounselorId,
      DomainPageRequest pageRequest);
}
