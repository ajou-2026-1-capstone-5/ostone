package com.init.payment.application;

public record BillingAuthorizationResult(
    SubscriptionResult subscription, BillingKeySummary billingKey) {}
