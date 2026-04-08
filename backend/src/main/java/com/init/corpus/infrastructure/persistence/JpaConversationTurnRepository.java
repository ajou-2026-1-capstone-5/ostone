package com.init.corpus.infrastructure.persistence;

import com.init.corpus.domain.model.ConversationTurn;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaConversationTurnRepository extends JpaRepository<ConversationTurn, Long> {}
