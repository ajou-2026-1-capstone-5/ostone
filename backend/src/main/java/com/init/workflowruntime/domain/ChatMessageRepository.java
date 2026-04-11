package com.init.workflowruntime.domain;

import java.util.List;
import java.util.Optional;

/** 채팅 메시지 영속성을 위한 도메인 포트 인터페이스입니다. */
public interface ChatMessageRepository {

  ChatMessage save(ChatMessage message);

  Optional<ChatMessage> findById(Long id);

  List<ChatMessage> findByChatSessionIdOrderBySeqNoAsc(Long chatSessionId);

  Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);
}
