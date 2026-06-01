package com.init.review.infrastructure;

import com.init.review.domain.model.ReviewTask;
import com.init.review.domain.repository.ReviewTaskRepository;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaReviewTaskRepository
    extends JpaRepository<ReviewTask, Long>, ReviewTaskRepository {

  @Override
  List<ReviewTask> findByReviewSessionIdOrderByIdAsc(Long reviewSessionId);
}
