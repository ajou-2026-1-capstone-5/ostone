package com.init.workspace.presentation.dto;

import com.init.workspace.application.AdminCustomerSliceResult;
import java.util.List;

public record AdminCustomerSliceResponse(
    List<AdminCustomerSummaryResponse> content, int page, int size, boolean hasNext) {

  public static AdminCustomerSliceResponse from(AdminCustomerSliceResult result) {
    return new AdminCustomerSliceResponse(
        result.content().stream().map(AdminCustomerSummaryResponse::from).toList(),
        result.page(),
        result.size(),
        result.hasNext());
  }
}
