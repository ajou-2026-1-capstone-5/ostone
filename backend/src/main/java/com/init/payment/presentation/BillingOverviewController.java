package com.init.payment.presentation;

import com.init.payment.application.BillingOverviewResult;
import com.init.payment.application.BillingOverviewService;
import com.init.payment.presentation.dto.BillingOverviewResponse;
import com.init.shared.presentation.AuthenticationUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/billing")
public class BillingOverviewController {

  private final BillingOverviewService billingOverviewService;

  public BillingOverviewController(BillingOverviewService billingOverviewService) {
    this.billingOverviewService = billingOverviewService;
  }

  @GetMapping("/overview")
  public ResponseEntity<BillingOverviewResponse> getBillingOverview(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    BillingOverviewResult result = billingOverviewService.getOverview(workspaceId, userId);
    return ResponseEntity.ok(BillingOverviewResponse.from(result));
  }
}
