package com.init.payment.presentation;

import com.init.payment.application.PlanCatalogService;
import com.init.payment.presentation.dto.PlanCatalogResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 요금제 카탈로그 조회 API. 로그인된 구독 탭의 요금제 비교 화면에서 호출한다. */
@RestController
@RequestMapping("/api/v1/plans")
public class PlanCatalogController {

  private final PlanCatalogService planCatalogService;

  public PlanCatalogController(PlanCatalogService planCatalogService) {
    this.planCatalogService = planCatalogService;
  }

  @GetMapping
  public List<PlanCatalogResponse> listPlans() {
    return planCatalogService.listActivePlans().stream().map(PlanCatalogResponse::from).toList();
  }
}
