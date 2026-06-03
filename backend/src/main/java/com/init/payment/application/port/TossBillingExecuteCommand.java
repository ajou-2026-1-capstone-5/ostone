package com.init.payment.application.port;

public record TossBillingExecuteCommand(
    String billingKey, String customerKey, long amount, String orderId, String orderName) {}
