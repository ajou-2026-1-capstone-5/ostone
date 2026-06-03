package com.init.payment.domain.repository;

import com.init.payment.domain.model.Plan;
import java.util.Optional;

public interface PlanRepository {

  Plan save(Plan plan);

  Optional<Plan> findById(Long id);

  Optional<Plan> findByPlanKey(String planKey);
}
