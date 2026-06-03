package com.init.payment.presentation;

import com.init.payment.application.CancelPaymentCommand;
import com.init.payment.application.ConfirmPaymentCommand;
import com.init.payment.application.PaymentResult;
import com.init.payment.application.PaymentService;
import com.init.payment.presentation.dto.CancelPaymentRequest;
import com.init.payment.presentation.dto.ConfirmPaymentRequest;
import com.init.payment.presentation.dto.PaymentResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/payments")
public class PaymentController {

  private final PaymentService paymentService;

  public PaymentController(PaymentService paymentService) {
    this.paymentService = paymentService;
  }

  @PostMapping("/confirm")
  public ResponseEntity<PaymentResponse> confirmPayment(
      @PathVariable Long workspaceId,
      @Valid @RequestBody ConfirmPaymentRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    PaymentResult result =
        paymentService.confirmPayment(
            new ConfirmPaymentCommand(
                workspaceId, userId, request.paymentKey(), request.orderId(), request.amount()));
    return ResponseEntity.ok(PaymentResponse.from(result));
  }

  @GetMapping
  public ResponseEntity<List<PaymentResponse>> getPayments(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    List<PaymentResponse> payments =
        paymentService.getPayments(workspaceId, userId).stream()
            .map(PaymentResponse::from)
            .toList();
    return ResponseEntity.ok(payments);
  }

  @PostMapping("/{paymentKey}/cancel")
  public ResponseEntity<PaymentResponse> cancelPayment(
      @PathVariable Long workspaceId,
      @PathVariable String paymentKey,
      @Valid @RequestBody CancelPaymentRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    PaymentResult result =
        paymentService.cancelPayment(
            new CancelPaymentCommand(
                workspaceId,
                userId,
                paymentKey,
                request.cancelReason(),
                request.cancelAmount(),
                UUID.randomUUID().toString().replace("-", "")));
    return ResponseEntity.ok(PaymentResponse.from(result));
  }
}
