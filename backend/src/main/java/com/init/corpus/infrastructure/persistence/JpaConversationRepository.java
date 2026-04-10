package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.Conversation;
import com.init.corpus.domain.repository.ConversationRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaConversationRepository
    extends JpaRepository<Conversation, Long>, ConversationRepository {}
