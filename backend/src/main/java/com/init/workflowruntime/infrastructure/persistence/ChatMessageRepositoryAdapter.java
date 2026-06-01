package com.init.workflowruntime.infrastructure.persistence;

import com.init.workflowruntime.domain.ChatMessage;
import com.init.workflowruntime.domain.ChatMessageRepository;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

/** ChatMessage 도메인 포트를 Spring Data JPA repository에 연결합니다. */
@Repository
public class ChatMessageRepositoryAdapter implements ChatMessageRepository {

  private final JpaChatMessageRepository jpaRepository;

  public ChatMessageRepositoryAdapter(JpaChatMessageRepository jpaRepository) {
    this.jpaRepository = jpaRepository;
  }

  @Override
  public ChatMessage save(ChatMessage message) {
    return jpaRepository.save(message);
  }

  @Override
  public Optional<ChatMessage> findById(Long id) {
    return jpaRepository.findById(id);
  }

  @Override
  public List<ChatMessage> findByChatSessionIdOrderBySeqNoAsc(Long chatSessionId) {
    return jpaRepository.findByChatSessionIdOrderBySeqNoAsc(chatSessionId);
  }

  @Override
  public DomainPage<ChatMessage> findByChatSessionIdOrderBySeqNoDesc(
      Long chatSessionId, DomainPageRequest pageRequest) {
    Page<ChatMessage> page =
        jpaRepository.findByChatSessionIdOrderBySeqNoDesc(
            chatSessionId, PageRequest.of(pageRequest.page(), pageRequest.size()));
    return toDomainPage(page);
  }

  @Override
  public List<ChatMessage> findTop5ByChatSessionIdOrderBySeqNoDesc(Long chatSessionId) {
    return jpaRepository.findTop5ByChatSessionIdOrderBySeqNoDesc(chatSessionId);
  }

  @Override
  public Optional<ChatMessage> findTopByChatSessionIdOrderBySeqNoDesc(Long chatSessionId) {
    return jpaRepository.findTopByChatSessionIdOrderBySeqNoDesc(chatSessionId);
  }

  private DomainPage<ChatMessage> toDomainPage(Page<ChatMessage> page) {
    return new DomainPage<>(
        page.getContent(),
        page.getNumber(),
        page.getSize(),
        page.getTotalElements(),
        page.getTotalPages());
  }
}
