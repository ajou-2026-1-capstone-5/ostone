package com.init.payment.application;

public record IssueBillingKeyCommand(
    Long workspaceId, Long userId, String authKey, String customerKey) {}
