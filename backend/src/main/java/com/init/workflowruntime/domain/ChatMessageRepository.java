package com.init.workflowruntime.domain;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
  // 특정 세션의 메시지들을 순번(seqNo) 오름차순으로 조회
  List<ChatMessage> findByChatSessionIdOrderBySeqNoAsc(Long chatSessionId);

  // 특정 세션의 가장 마지막 순번(seqNo) 조회용 보조 메서드
  Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId);
}
