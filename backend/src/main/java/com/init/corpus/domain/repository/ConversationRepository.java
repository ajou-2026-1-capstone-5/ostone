package com.init.corpus.domain.repository;

import com.init.corpus.domain.model.Conversation;

public interface ConversationRepository {

  Conversation save(Conversation conversation);
}
