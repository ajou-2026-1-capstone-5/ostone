package com.init.review.domain.repository;

import com.init.review.domain.model.ReviewTask;
import java.util.List;
import java.util.Optional;

public interface ReviewTaskRepository {

  List<ReviewTask> findByReviewSessionIdOrderByIdAsc(Long reviewSessionId);

  Optional<ReviewTask> findById(Long id);

  <S extends ReviewTask> S save(S reviewTask);

  <S extends ReviewTask> List<S> saveAll(Iterable<S> reviewTasks);
}
