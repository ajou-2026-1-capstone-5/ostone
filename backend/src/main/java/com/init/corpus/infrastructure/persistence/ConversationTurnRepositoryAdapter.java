package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.ConversationTurn;
import com.init.corpus.domain.repository.ConversationTurnRepository;
import java.util.List;
import org.springframework.stereotype.Repository;

@Repository
public class ConversationTurnRepositoryAdapter implements ConversationTurnRepository {

  private final JpaConversationTurnRepository jpa;

  public ConversationTurnRepositoryAdapter(JpaConversationTurnRepository jpa) {
    this.jpa = jpa;
  }

  @Override
  public ConversationTurn save(ConversationTurn turn) {
    return jpa.save(turn);
  }

  @Override
  public List<ConversationTurn> saveAll(List<ConversationTurn> turns) {
    return jpa.saveAll(turns);
  }
}
