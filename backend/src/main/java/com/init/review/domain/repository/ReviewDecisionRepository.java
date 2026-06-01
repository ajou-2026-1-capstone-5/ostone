package com.init.review.domain.repository;

import com.init.review.domain.model.ReviewDecision;

public interface ReviewDecisionRepository {

  <S extends ReviewDecision> S save(S reviewDecision);
}
