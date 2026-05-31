package com.init.review.infrastructure;

import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.repository.ReviewDecisionRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaReviewDecisionRepository
    extends JpaRepository<ReviewDecision, Long>, ReviewDecisionRepository {}
