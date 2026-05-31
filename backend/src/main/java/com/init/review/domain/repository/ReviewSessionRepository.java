package com.init.review.domain.repository;

import com.init.review.domain.model.ReviewSession;
import java.util.Optional;

public interface ReviewSessionRepository {

  Optional<ReviewSession> findById(Long id);

  Optional<ReviewSession> findFirstByPipelineJobIdAndReviewKindOrderByOpenedAtDesc(
      Long pipelineJobId, String reviewKind);

  <S extends ReviewSession> S save(S reviewSession);
}
