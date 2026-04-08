package com.init.workflowruntime.application;

import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionRepository;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 상담 시스템의 비즈니스 로직을 처리하는 서비스 클래스입니다.
 * 상담 세션 관리와 메시지 이력 조회, 답변 전송 기능을 담당합니다.
 */
@Service
@Transactional(readOnly = true)
public class ConsultationService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;

  /**
   * ConsultationService 생성자입니다.
   *
   * @param chatSessionRepository 상담 세션 저장소
   * @param chatMessageRepository 상담 메시지 저장소
   */
  public ConsultationService(
      ChatSessionRepository chatSessionRepository, ChatMessageRepository chatMessageRepository) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
  }

  /**
   * 실시간으로 활성화된(상담 중인) 세션 목록을 조회합니다.
   *
   * @return 활성 상담 세션 응답 목록
   */
  public List<ChatSessionResponse> getActiveQueue() {
    List<ChatSession> sessions = chatSessionRepository.findByStatusOrderByStartedAtDesc("OPEN");
    return sessions.stream().map(ChatSessionResponse::from).collect(Collectors.toList());
  }

  /**
   * 특정 세션의 대화 내역(메시지 목록)을 순서대로 조회합니다.
   *
   * @param sessionId 조회할 세션 ID
   * @return 메시지 상세 응답 목록
   * @throws IllegalArgumentException 세션이 존재하지 않을 경우 발생
   */
  public List<ChatMessageResponse> getMessages(@NonNull Long sessionId) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

    Long id = session.getId();
    if (id == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    return chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(id).stream()
        .map(ChatMessageResponse::from)
        .collect(Collectors.toList());
  }

  /**
   * 상담사가 작성한 메시지를 세션에 저장하고 응답을 반환합니다.
   * 일반 메시지뿐만 아니라 상담사 전용 '노트' 기능도 지원합니다.
   *
   * @param sessionId 메시지를 전송할 세션 ID
   * @param request 전송할 메시지 데이터
   * @return 생성된 메시지 상세 응답
   * @throws IllegalArgumentException 세션이 존재하지 않을 경우 발생
   */
  @Transactional
  public ChatMessageResponse sendMessage(
      @NonNull Long sessionId, @NonNull SendMessageRequest request) {
    ChatSession session =
        chatSessionRepository
            .findById(sessionId)
            .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

    if (session.getId() == null) {
      throw new IllegalStateException("Session ID cannot be null");
    }

    Integer nextSeqNo =
        chatMessageRepository
            .findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
            .map(msg -> msg.getSeqNo() + 1)
            .orElse(1);

    String role = request.isNote() ? "NOTE" : "AGENT";
    String messageType = "TEXT";

    ChatMessage newMessage = ChatMessage.create(session.getId(), nextSeqNo, role, messageType, request.getContent());
    if (newMessage == null) {
      throw new IllegalStateException("Failed to create ChatMessage");
    }
    chatMessageRepository.save(newMessage);

    return ChatMessageResponse.from(newMessage);
  }

  /**
   * 상담 세션의 현재 상태(상담중, 해결됨 등)를 물리적으로 업데이트합니다.
   *
   * @param sessionId 상태를 변경할 세션 ID
   * @param status 새로운 상태 값
   * @return 업데이트된 세션 상세 응답
   * @throws IllegalArgumentException 세션이 존재하지 않을 경우 발생
   */
  @Transactional
  public ChatSessionResponse updateSessionStatus(@NonNull Long sessionId, String status) {
    ChatSession session = chatSessionRepository.findById(sessionId)
        .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

    if ("COMPLETED".equalsIgnoreCase(status)) {
      session.closeSession();
    }
    
    return ChatSessionResponse.from(session);
  }
}
