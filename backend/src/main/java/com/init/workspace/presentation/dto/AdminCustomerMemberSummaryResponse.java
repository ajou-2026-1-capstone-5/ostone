package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerMemberSummaryResult;
import java.util.List;

public record AdminCustomerMemberSummaryResponse(
    long totalCount,
    long ownerCount,
    long adminCount,
    long reviewerCount,
    long operatorCount,
    List<AdminCustomerMemberEntryResponse> recentMembers) {

  static AdminCustomerMemberSummaryResponse from(AdminCustomerMemberSummaryResult result) {
    return new AdminCustomerMemberSummaryResponse(
        result.totalCount(),
        result.ownerCount(),
        result.adminCount(),
        result.reviewerCount(),
        result.operatorCount(),
        result.recentMembers().stream().map(AdminCustomerMemberEntryResponse::from).toList());
  }
}
