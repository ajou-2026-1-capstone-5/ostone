package com.init.review.testfixture;

import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.spy;

import com.init.review.domain.model.ReviewDecision;
import com.init.review.domain.model.ReviewSession;
import com.init.review.domain.model.ReviewTask;

public final class ReviewFixtures {

  private ReviewFixtures() {}

  public static ReviewSession persisted(ReviewSession session, Long id) {
    ReviewSession persisted = spy(session);
    lenient().doReturn(id).when(persisted).getId();
    return persisted;
  }

  public static ReviewDecision persisted(ReviewDecision decision, Long id) {
    ReviewDecision persisted = spy(decision);
    lenient().doReturn(id).when(persisted).getId();
    return persisted;
  }

  public static ReviewTask persisted(ReviewTask task, Long id) {
    ReviewTask persisted = spy(task);
    lenient().doReturn(id).when(persisted).getId();
    return persisted;
  }
}
