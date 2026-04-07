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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ConsultationService {

  private final ChatSessionRepository chatSessionRepository;
  private final ChatMessageRepository chatMessageRepository;

  public ConsultationService(ChatSessionRepository chatSessionRepository, ChatMessageRepository chatMessageRepository) {
    this.chatSessionRepository = chatSessionRepository;
    this.chatMessageRepository = chatMessageRepository;
  }

  public List<ChatSessionResponse> getActiveQueue() {
    List<ChatSession> sessions = chatSessionRepository.findByStatusOrderByStartedAtDesc("OPEN");
    return sessions.stream().map(ChatSessionResponse::from).collect(Collectors.toList());
  }

  public List<ChatMessageResponse> getMessages(Long sessionId) {
    List<ChatMessage> messages = chatMessageRepository.findByChatSessionIdOrderBySeqNoAsc(sessionId);
    return messages.stream().map(ChatMessageResponse::from).collect(Collectors.toList());
  }

  @Transactional
  public ChatMessageResponse sendMessage(Long sessionId, SendMessageRequest request) {
    ChatSession session = chatSessionRepository.findById(sessionId)
        .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

    Integer nextSeqNo = chatMessageRepository.findTopByChatSessionIdOrderBySeqNoDesc(sessionId)
        .map(msg -> msg.getSeqNo() + 1)
        .orElse(1);

    String role = request.isNote() ? "NOTE" : "AGENT";
    String messageType = "TEXT";

    ChatMessage newMessage = ChatMessage.create(session.getId(), nextSeqNo, role, messageType, request.getContent());
    chatMessageRepository.save(newMessage);

    return ChatMessageResponse.from(newMessage);
  }

  @Transactional
  public ChatSessionResponse updateSessionStatus(Long sessionId, String newStatus) {
    ChatSession session = chatSessionRepository.findById(sessionId)
        .orElseThrow(() -> new IllegalArgumentException("Session not found: " + sessionId));

    if ("COMPLETED".equalsIgnoreCase(newStatus)) {
      session.closeSession();
    }
    
    return ChatSessionResponse.from(session);
  }
}
