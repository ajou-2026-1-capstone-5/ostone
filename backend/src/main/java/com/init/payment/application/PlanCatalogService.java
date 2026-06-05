package com.init.payment.application;

import com.init.payment.domain.model.Plan;
import com.init.payment.domain.repository.PlanRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 활성 요금제 카탈로그 조회 — 구독 탭의 요금제 비교 화면 단일 출처. */
@Service
@Transactional(readOnly = true)
public class PlanCatalogService {

  private final PlanRepository planRepository;

  public PlanCatalogService(PlanRepository planRepository) {
    this.planRepository = planRepository;
  }

  public List<PlanCatalogResult> listActivePlans() {
    return planRepository.findAllByStatusOrderByAmountAsc(Plan.STATUS_ACTIVE).stream()
        .map(PlanCatalogResult::from)
        .toList();
  }
}
