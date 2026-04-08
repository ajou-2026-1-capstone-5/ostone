package com.init.workflowruntime.domain;

import java.util.List;
import java.util.Optional;

/**
 * 채팅 메시지 영속성을 위한 도메인 포트 인터페이스입니다.
 */
public interface ChatMessageRepository {
  /**
   * 메시지를 저장합니다.
   *
   * @param message 저장할 메시지 엔티티
   * @return 저장된 메시지 엔티티
   */
  ChatMessage save(ChatMessage message);

  /**
   * ID로 메시지를 조회합니다.
   *
   * @param id 메시지 ID
   * @return 조회된 메시지 (Optional)
   */
  Optional<ChatMessage> findById(Long id);

  /**
   * 특정 세션의 메시지들을 순번(seqNo) 오름차순으로 조회합니다.
   *
   * @param chatSessionId 세션 ID
   * @return 메시지 목록
   */
  List<ChatMessage> findByChatSessionIdOrderBySeqNoAsc(Long chatSessionId);

  /**
   * 특정 세션의 가장 마지막 순번(seqNo) 조회용 보조 메서드입니다.
   *
   * @param chatSessionId 세션 ID
   * @return 마지막 메시지 (Optional)
   */
  Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);
}
