package com.init.payment.application;

public record CreateSubscriptionCommand(Long workspaceId, Long userId, String planKey) {}
