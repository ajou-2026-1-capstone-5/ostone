package com.init.payment.presentation;

import com.init.payment.application.AdminBillingRefundCommand;
import com.init.payment.application.AdminBillingUseCase;
import com.init.payment.presentation.dto.AdminBillingCustomerResponse;
import com.init.payment.presentation.dto.AdminBillingRefundRequest;
import com.init.payment.presentation.dto.AdminBillingRefundResponse;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/billing")
public class AdminBillingController {

  private final AdminBillingUseCase adminBillingUseCase;

  public AdminBillingController(AdminBillingUseCase adminBillingUseCase) {
    this.adminBillingUseCase = adminBillingUseCase;
  }

  @GetMapping("/customers")
  public List<AdminBillingCustomerResponse> findCustomerBillingSummaries() {
    return adminBillingUseCase.findCustomerSummaries().stream()
        .map(AdminBillingCustomerResponse::from)
        .toList();
  }

  @PostMapping("/payments/{paymentId}/refunds")
  public AdminBillingRefundResponse refundFull(
      @PathVariable Long paymentId, @Valid @RequestBody AdminBillingRefundRequest request) {
    return AdminBillingRefundResponse.from(
        adminBillingUseCase.refundFull(
            new AdminBillingRefundCommand(paymentId, request.reason().trim())));
  }
}
