package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.ConversationTurn;

public interface ConversationTurnRepository {

  ConversationTurn save(ConversationTurn turn);
}
