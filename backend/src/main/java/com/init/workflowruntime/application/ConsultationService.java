package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessagePageResponse;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.application.dto.SessionResolutionOutcome;
import com.init.workflowruntime.application.dto.UpdateStatusRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 상담 시스템의 비즈니스 로직을 처리하는 서비스 클래스입니다. 상담 세션 관리와 메시지 이력 조회, 답변 전송 기능을 담당합니다. */
@Service
@Transactional(readOnly = true)
public class ConsultationService {

  private static final int DEFAULT_MESSAGE_PAGE = 0;
  private static final int DEFAULT_MESSAGE_PAGE_SIZE = 50;
  private static final int MAX_MESSAGE_PAGE_SIZE = 100;
  private static final String SIMULATION_CHANNEL = "SIMULATION";

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final WorkspaceMemberRepository workspaceMemberRepository;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;

  public ConsultationService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      WorkspaceMemberRepository workspaceMemberRepository,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.workspaceMemberRepository = workspaceMemberRepository;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
  }

  public List<ChatSessionResponse> getActiveQueue(Long workspaceId, Long userId) {
    validateWorkspaceMembership(workspaceId, userId);
    return chatSessionRepository
        .findByWorkspaceIdAndStatusInOrderByStartedAtDesc(
            workspaceId, Arrays.asList(ChatSessionStatus.OPEN, ChatSessionStatus.ACTIVE))
        .stream()
        .sorted(this::compareQueuePriority)
        .map(ChatSessionResponse::from)
        .collect(Collectors.toList());
  }

  public List<ChatMessageResponse> getMessages(@NonNull Long sessionId, @NonNull Long userId) {
    return getMessages(sessionId, userId, DEFAULT_MESSAGE_PAGE, DEFAULT_MESSAGE_PAGE_SIZE)
        .content();
  }

  public ChatMessagePageResponse getMessages(
      @NonNull Long sessionId, @NonNull Long userId, int page, int size) {
    validateMessagePaging(page, size);
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateWorkspaceMembership(session.getWorkspaceId(), userId);
    validateOperationalSession(session);

    Long id = session.getId();
    if (id == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    DomainPage<ChatMessage> messagePage =
        chatMessageRepository.findByChatSessionIdOrderBySeqNoDesc(
            id, new DomainPageRequest(page, size));
    List<ChatMessage> chronologicalMessages = new ArrayList<>(messagePage.content());
    Collections.reverse(chronologicalMessages);

    List<ChatMessageResponse> content =
        chronologicalMessages.stream().map(ChatMessageResponse::from).collect(Collectors.toList());

    return new ChatMessagePageResponse(
        content,
        messagePage.page(),
        messagePage.size(),
        messagePage.totalElements(),
        messagePage.totalPages());
  }

  @Transactional
  public ChatMessageResponse sendMessage(
      @NonNull Long sessionId, @NonNull SendMessageRequest request, @NonNull Long userId) {
    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateWorkspaceMembership(session.getWorkspaceId(), userId);
    validateOperationalSession(session);

    if (session.getId() == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    String role = request.isNote() ? "NOTE" : "AGENT";
    String messageType = "TEXT";

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    ChatMessage newMessage =
        ChatMessage.create(session.getId(), nextSeqNo, role, messageType, request.getContent());
    ChatMessage savedMessage = chatMessageRepository.save(newMessage);
    chatSessionMetadataService.updateAfterMessage(session, savedMessage);
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return ChatMessageResponse.from(savedMessage);
  }

  @Transactional
  public ChatSessionResponse updateSessionStatus(
      @NonNull Long sessionId, @NonNull String status, @NonNull Long userId) {
    UpdateStatusRequest request = new UpdateStatusRequest();
    request.setStatus(status);
    return updateSessionStatus(sessionId, request, userId);
  }

  @Transactional
  public ChatSessionResponse updateSessionStatus(
      @NonNull Long sessionId, @NonNull UpdateStatusRequest request, @NonNull Long userId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateWorkspaceMembership(session.getWorkspaceId(), userId);
    validateOperationalSession(session);

    ChatSessionStatus newStatus = parseStatus(request.getStatus());
    SessionResolutionOutcome outcome = parseOutcome(request.getResolutionOutcome());
    if (outcome != null && outcome.getDefaultStatus() != newStatus) {
      throw new BadRequestException(
          "INVALID_RESOLUTION_STATUS",
          "Resolution outcome "
              + outcome.name()
              + " requires status "
              + outcome.getDefaultStatus());
    }

    switch (newStatus) {
      case COMPLETED -> session.closeSession();
      case ACTIVE -> session.activate();
      case RESOLVED -> session.resolve();
      case OPEN -> session.reopen();
    }

    if (newStatus == ChatSessionStatus.RESOLVED || newStatus == ChatSessionStatus.COMPLETED) {
      chatSessionMetadataService.resolveHandoff(session);
    }

    if (outcome != null) {
      boolean followUpRequired =
          request.getFollowUpRequired() != null
              ? request.getFollowUpRequired()
              : outcome.isDefaultFollowUpRequired();
      chatSessionMetadataService.recordResolution(
          session,
          outcome.name(),
          outcome.getLabel(),
          newStatus.name(),
          request.getResolutionReason(),
          followUpRequired);
    }

    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, queueEventTypeFor(newStatus)));

    return ChatSessionResponse.from(session);
  }

  private ChatSessionStatus parseStatus(String status) {
    if (status == null || status.isBlank()) {
      throw new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: " + status);
    }
    try {
      return ChatSessionStatus.valueOf(status.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: " + status);
    }
  }

  private SessionResolutionOutcome parseOutcome(String resolutionOutcome) {
    if (resolutionOutcome == null || resolutionOutcome.isBlank()) {
      return null;
    }
    try {
      return SessionResolutionOutcome.valueOf(resolutionOutcome.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException(
          "UNSUPPORTED_RESOLUTION_OUTCOME", "Unsupported resolution outcome: " + resolutionOutcome);
    }
  }

  private ConsultationQueueEventType queueEventTypeFor(ChatSessionStatus status) {
    return switch (status) {
      case OPEN, ACTIVE -> ConsultationQueueEventType.SESSION_UPSERTED;
      case RESOLVED, COMPLETED -> ConsultationQueueEventType.SESSION_REMOVED;
    };
  }

  private void validateMessagePaging(int page, int size) {
    if (page < 0 || size <= 0 || size > MAX_MESSAGE_PAGE_SIZE) {
      throw new BadRequestException(
          "INVALID_PAGING",
          "page must be >= 0 and size must be between 1 and " + MAX_MESSAGE_PAGE_SIZE);
    }
  }

  private int compareQueuePriority(ChatSession left, ChatSession right) {
    boolean leftHandoff = chatSessionMetadataService.isHandoffRequired(left);
    boolean rightHandoff = chatSessionMetadataService.isHandoffRequired(right);
    if (leftHandoff != rightHandoff) {
      return leftHandoff ? -1 : 1;
    }
    if (leftHandoff) {
      return Comparator.nullsLast(Comparator.<OffsetDateTime>naturalOrder())
          .compare(queueHandoffTime(left), queueHandoffTime(right));
    }
    return Comparator.nullsLast(Comparator.<OffsetDateTime>reverseOrder())
        .compare(left.getStartedAt(), right.getStartedAt());
  }

  private OffsetDateTime queueHandoffTime(ChatSession session) {
    OffsetDateTime handoffAt = chatSessionMetadataService.handoffAt(session);
    return handoffAt != null ? handoffAt : session.getStartedAt();
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private void validateOperationalSession(ChatSession session) {
    if (SIMULATION_CHANNEL.equals(session.getChannel())) {
      throw new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + session.getId());
    }
  }
}
