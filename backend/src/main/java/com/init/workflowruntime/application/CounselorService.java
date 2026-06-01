package com.init.workflowruntime.application;

import com.init.shared.application.exception.BadRequestException;
import com.init.shared.application.exception.NotFoundException;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import com.init.workflowruntime.application.dto.UpdateResponseModeRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import com.init.workflowruntime.domain.ChatSessionResponseMode;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.event.ConsultationQueueChangedEvent;
import com.init.workflowruntime.domain.event.ConsultationQueueEventType;
import com.init.workflowruntime.domain.event.SessionAssignedEvent;
import com.init.workspace.application.exception.WorkspaceAccessDeniedException;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Service
@Transactional(readOnly = true)
public class CounselorService {

  private static final ZoneId HISTORY_FILTER_ZONE = ZoneId.of("Asia/Seoul");

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;
  private final SimpMessagingTemplate messagingTemplate;
  private final ApplicationEventPublisher eventPublisher;
  private final ChatSessionMetadataService chatSessionMetadataService;
  private final WorkspaceMemberRepository workspaceMemberRepository;

  public CounselorService(
      ChatSessionRepository chatSessionRepository,
      ChatMessageRepository chatMessageRepository,
      SimpMessagingTemplate messagingTemplate,
      ApplicationEventPublisher eventPublisher,
      ChatSessionMetadataService chatSessionMetadataService,
      WorkspaceMemberRepository workspaceMemberRepository) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
    this.messagingTemplate = messagingTemplate;
    this.eventPublisher = eventPublisher;
    this.chatSessionMetadataService = chatSessionMetadataService;
    this.workspaceMemberRepository = workspaceMemberRepository;
  }

  @Transactional
  public CounselorSessionResponse assignSession(Long sessionId, Long counselorId) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    validateWorkspaceMembership(session.getWorkspaceId(), counselorId);
    session.assignTo(counselorId);
    chatSessionRepository.save(session);

    eventPublisher.publishEvent(new SessionAssignedEvent(sessionId, counselorId));
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return CounselorSessionResponse.from(session);
  }

  @Transactional
  public CounselorSessionResponse releaseSession(Long sessionId, Long counselorId) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    validateWorkspaceMembership(session.getWorkspaceId(), counselorId);
    if (!Objects.equals(counselorId, session.getAssignedCounselorId())) {
      throw new BadRequestException(
          "SESSION_NOT_ASSIGNED_TO_COUNSELOR",
          "Session " + sessionId + " is not assigned to counselor: " + counselorId);
    }

    session.releaseFrom();
    chatSessionRepository.save(session);
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return CounselorSessionResponse.from(session);
  }

  public boolean isSessionAssigned(Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    return session.getAssignedCounselorId() != null;
  }

  public List<ChatSessionResponse> getAssignedSessions(Long counselorId) {
    return chatSessionRepository.findByAssignedCounselorId(counselorId).stream()
        .map(ChatSessionResponse::from)
        .collect(Collectors.toList());
  }

  @Transactional
  public ChatMessageResponse sendCounselorMessage(
      Long sessionId, String content, Long counselorId, boolean isNote) {
    validateCounselorId(counselorId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));

    if (!Objects.equals(counselorId, session.getAssignedCounselorId())) {
      throw new BadRequestException(
          "SESSION_NOT_ASSIGNED",
          "Session " + sessionId + " is not assigned to counselor: " + counselorId);
    }

    ChatSessionStatus status = session.getStatus();
    if (status != ChatSessionStatus.ACTIVE) {
      throw new BadRequestException(
          "SESSION_NOT_ACTIVE",
          "Session " + sessionId + " is not ACTIVE; current status: " + status);
    }

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    String senderRole = isNote ? "NOTE" : "COUNSELOR";
    ChatMessage message = ChatMessage.create(sessionId, nextSeqNo, senderRole, "TEXT", content);
    ChatMessage savedMessage = chatMessageRepository.save(message);
    if (!isNote) {
      session.markHumanResponding();
    }
    chatSessionMetadataService.updateAfterMessage(session, savedMessage);

    ChatMessageResponse response = ChatMessageResponse.from(savedMessage);
    String destination = "/topic/chat." + sessionId;
    TransactionSynchronizationManager.registerSynchronization(
        new TransactionSynchronization() {
          @Override
          public void afterCommit() {
            messagingTemplate.convertAndSend(destination, response);
          }
        });

    return response;
  }

  @Transactional
  public CounselorSessionResponse updateResponseMode(
      Long sessionId, UpdateResponseModeRequest request, Long userId) {
    validateCounselorId(userId);

    ChatSession session =
        chatSessionRepository
            .findByIdForUpdate(sessionId)
            .orElseThrow(
                () ->
                    new NotFoundException("SESSION_NOT_FOUND", "Session not found: " + sessionId));
    validateWorkspaceMembership(session.getWorkspaceId(), userId);

    if (!Objects.equals(request.getCounselorId(), userId)) {
      throw new BadRequestException(
          "COUNSELOR_ID_MISMATCH", "counselorId must match authenticated user");
    }

    if (!Objects.equals(userId, session.getAssignedCounselorId())) {
      throw new BadRequestException(
          "SESSION_NOT_ASSIGNED",
          "Session " + sessionId + " is not assigned to counselor: " + userId);
    }

    session.switchResponseMode(parseResponseMode(request.getResponseMode()));
    chatSessionRepository.save(session);
    eventPublisher.publishEvent(
        new ConsultationQueueChangedEvent(
            session.getWorkspaceId(), sessionId, ConsultationQueueEventType.SESSION_UPSERTED));

    return CounselorSessionResponse.from(session);
  }

  public CounselorSessionResponse getSessions(
      Long workspaceId,
      Long userId,
      String status,
      String keyword,
      LocalDate startedFrom,
      LocalDate startedTo,
      Long assignedCounselorId,
      int page,
      int size) {
    if (workspaceId == null || workspaceId <= 0) {
      throw new BadRequestException(
          "INVALID_WORKSPACE_ID", "workspaceId must be a positive number");
    }
    validateWorkspaceMembership(workspaceId, userId);
    if (page < 0 || size <= 0) {
      throw new BadRequestException("INVALID_PAGING", "page must be >= 0 and size must be > 0");
    }
    if (assignedCounselorId != null && assignedCounselorId <= 0) {
      throw new BadRequestException(
          "INVALID_COUNSELOR_ID", "assignedCounselorId must be a positive number");
    }
    if (startedFrom != null && startedTo != null && startedFrom.isAfter(startedTo)) {
      throw new BadRequestException(
          "INVALID_DATE_RANGE", "startedFrom must be before or equal to startedTo");
    }

    ChatSessionStatus sessionStatus = null;
    if (status != null && !status.isBlank()) {
      try {
        sessionStatus = ChatSessionStatus.valueOf(status.toUpperCase());
      } catch (IllegalArgumentException e) {
        throw new BadRequestException("UNSUPPORTED_STATUS", "Unsupported status: " + status);
      }
    }

    String normalizedKeyword = normalizeKeyword(keyword);
    OffsetDateTime startedFromDateTime = toStartOfDay(startedFrom);
    OffsetDateTime startedBeforeDateTime = toExclusiveEndDate(startedTo);
    PageRequest pageRequest = PageRequest.of(page, size);
    Page<ChatSession> sessionPage =
        chatSessionRepository.searchByWorkspace(
            workspaceId,
            sessionStatus != null ? sessionStatus.name() : null,
            normalizedKeyword,
            startedFromDateTime,
            startedBeforeDateTime,
            assignedCounselorId,
            pageRequest);

    List<ChatSessionResponse> content =
        sessionPage.getContent().stream()
            .map(ChatSessionResponse::from)
            .collect(Collectors.toList());

    return new CounselorSessionResponse(
        content,
        sessionPage.getNumber(),
        sessionPage.getSize(),
        sessionPage.getTotalElements(),
        sessionPage.getTotalPages());
  }

  private void validateCounselorId(Long counselorId) {
    if (counselorId == null) {
      throw new BadRequestException("INVALID_COUNSELOR_ID", "counselorId must not be null");
    }
  }

  private void validateWorkspaceMembership(Long workspaceId, Long userId) {
    workspaceMemberRepository
        .findByWorkspaceIdAndUserId(workspaceId, userId)
        .orElseThrow(() -> new WorkspaceAccessDeniedException("워크스페이스에 접근 권한이 없습니다."));
  }

  private ChatSessionResponseMode parseResponseMode(String responseMode) {
    if (responseMode == null || responseMode.isBlank()) {
      throw new BadRequestException(
          "UNSUPPORTED_RESPONSE_MODE", "Unsupported response mode: " + responseMode);
    }
    try {
      return ChatSessionResponseMode.valueOf(responseMode.toUpperCase());
    } catch (IllegalArgumentException e) {
      throw new BadRequestException(
          "UNSUPPORTED_RESPONSE_MODE", "Unsupported response mode: " + responseMode);
    }
  }

  private String normalizeKeyword(String keyword) {
    if (keyword == null || keyword.isBlank()) {
      return null;
    }
    return keyword
        .trim()
        .toLowerCase(Locale.ROOT)
        .replace("\\", "\\\\")
        .replace("%", "\\%")
        .replace("_", "\\_");
  }

  private OffsetDateTime toStartOfDay(LocalDate date) {
    if (date == null) {
      return null;
    }
    return date.atStartOfDay(HISTORY_FILTER_ZONE).toOffsetDateTime();
  }

  private OffsetDateTime toExclusiveEndDate(LocalDate date) {
    if (date == null) {
      return null;
    }
    return date.plusDays(1).atStartOfDay(HISTORY_FILTER_ZONE).toOffsetDateTime();
  }
}
