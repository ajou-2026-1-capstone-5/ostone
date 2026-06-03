package com.init.workspace.application;

import java.util.List;

public record AdminCustomerMemberSummaryResult(
    long totalCount,
    long ownerCount,
    long adminCount,
    long reviewerCount,
    long operatorCount,
    List<AdminCustomerMemberEntryResult> recentMembers) {}
