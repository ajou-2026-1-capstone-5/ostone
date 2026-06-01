package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

/** ChatSession 도메인 포트를 Spring Data JPA repository에 연결합니다. */
@Repository
public class ChatSessionRepositoryAdapter implements ChatSessionRepository {

  private final JpaChatSessionRepository jpaRepository;

  public ChatSessionRepositoryAdapter(JpaChatSessionRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public Optional<ChatSession> findById(Long id) {
    return jpaRepository.findById(id);
  }

  @Override
  public Optional<ChatSession> findByIdForUpdate(Long id) {
    return jpaRepository.findByIdForUpdate(id);
  }

  @Override
  public ChatSession save(ChatSession session) {
    return jpaRepository.save(session);
  }

  @Override
  public List<ChatSession> findByStatusOrderByStartedAtDesc(ChatSessionStatus status) {
    return jpaRepository.findByStatusOrderByStartedAtDesc(status);
  }

  @Override
  public List<ChatSession> findByStatusInOrderByStartedAtDesc(
      Collection<ChatSessionStatus> statuses) {
    return jpaRepository.findByStatusInOrderByStartedAtDesc(statuses);
  }

  @Override
  public List<ChatSession> findByWorkspaceIdAndStatusInOrderByStartedAtDesc(
      Long workspaceId, Collection<ChatSessionStatus> statuses) {
    return jpaRepository.findByWorkspaceIdAndStatusInOrderByStartedAtDesc(workspaceId, statuses);
  }

  @Override
  public List<ChatSession> findByAssignedCounselorId(Long counselorId) {
    return jpaRepository.findByAssignedCounselorId(counselorId);
  }

  @Override
  public Optional<ChatSession>
      findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
          Long workspaceId, Long startedBy, Collection<ChatSessionStatus> statuses) {
    return jpaRepository.findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
        workspaceId, startedBy, statuses);
  }

  @Override
  public DomainPage<ChatSession> findByWorkspaceId(
      Long workspaceId, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceId(
            workspaceId, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<ChatSession> findByWorkspaceIdAndStatus(
      Long workspaceId, ChatSessionStatus status, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByWorkspaceIdAndStatus(
            workspaceId, status, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<ChatSession> findByStatus(
      ChatSessionStatus status, DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findByStatus(status, PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<ChatSession> findAll(DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.findAll(PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  @Override
  public DomainPage<ChatSession> searchByWorkspace(
      Long workspaceId,
      String status,
      String keyword,
      OffsetDateTime startedFrom,
      OffsetDateTime startedBefore,
      Long assignedCounselorId,
      DomainPageRequest pageRequest) {
    return toDomainPage(
        jpaRepository.searchByWorkspace(
            workspaceId,
            status,
            keyword,
            startedFrom,
            startedBefore,
            assignedCounselorId,
            PageRequest.of(pageRequest.page(), pageRequest.size())));
  }

  private DomainPage<ChatSession> toDomainPage(Page<ChatSession> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
