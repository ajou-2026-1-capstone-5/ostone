package com.init.payment.infrastructure.persistence;

import com.init.payment.domain.model.Plan;
import com.init.payment.domain.repository.PlanRepository;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface JpaPlanRepository extends JpaRepository<Plan, Long>, PlanRepository {}
