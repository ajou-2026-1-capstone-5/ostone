package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.ConversationTurn;
import java.util.List;

public interface ConversationTurnRepository {

  ConversationTurn save(ConversationTurn turn);

  List<ConversationTurn> saveAll(List<ConversationTurn> turns);

  void flush();
}
