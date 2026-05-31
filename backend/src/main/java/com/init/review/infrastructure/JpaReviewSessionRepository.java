package com.init.review.infrastructure;

import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.repository.ReviewSessionRepository;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaReviewSessionRepository
    extends JpaRepository<ReviewSession, Long>, ReviewSessionRepository {

  @Override
  Optional<ReviewSession> findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
      Long pipelineJobId, String reviewKind);
}
