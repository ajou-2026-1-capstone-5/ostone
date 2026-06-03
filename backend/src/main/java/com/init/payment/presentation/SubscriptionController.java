package com.init.payment.presentation;

import com.init.payment.application.BillingAuthorizationResult;
import com.init.payment.application.CreateSubscriptionCommand;
import com.init.payment.application.IssueBillingKeyCommand;
import com.init.payment.application.SubscriptionResult;
import com.init.payment.application.SubscriptionService;
import com.init.payment.presentation.dto.BillingAuthorizationRequest;
import com.init.payment.presentation.dto.BillingAuthorizationResponse;
import com.init.payment.presentation.dto.CreateSubscriptionRequest;
import com.init.payment.presentation.dto.SubscriptionResponse;
import com.init.shared.presentation.AuthenticationUtils;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}")
public class SubscriptionController {

  private final SubscriptionService subscriptionService;

  public SubscriptionController(SubscriptionService subscriptionService) {
    this.subscriptionService = subscriptionService;
  }

  @GetMapping("/subscription")
  public ResponseEntity<SubscriptionResponse> getSubscription(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    SubscriptionResult result = subscriptionService.getSubscription(workspaceId, userId);
    return ResponseEntity.ok(SubscriptionResponse.from(result));
  }

  @PostMapping("/subscription")
  public ResponseEntity<SubscriptionResponse> createSubscription(
      @PathVariable Long workspaceId,
      @Valid @RequestBody CreateSubscriptionRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    SubscriptionResult result =
        subscriptionService.createSubscription(
            new CreateSubscriptionCommand(workspaceId, userId, request.planKey()));
    return ResponseEntity.status(HttpStatus.CREATED).body(SubscriptionResponse.from(result));
  }

  @DeleteMapping("/subscription")
  public ResponseEntity<SubscriptionResponse> cancelSubscription(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    SubscriptionResult result = subscriptionService.cancelSubscription(workspaceId, userId);
    return ResponseEntity.ok(SubscriptionResponse.from(result));
  }

  @PostMapping("/billing/authorizations")
  public ResponseEntity<BillingAuthorizationResponse> issueBillingKey(
      @PathVariable Long workspaceId,
      @Valid @RequestBody BillingAuthorizationRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    BillingAuthorizationResult result =
        subscriptionService.issueBillingKey(
            new IssueBillingKeyCommand(
                workspaceId, userId, request.authKey(), request.customerKey()));
    return ResponseEntity.ok(BillingAuthorizationResponse.from(result));
  }
}
