package com.init.workspace.application;

import java.util.List;

public record AdminCustomerSliceResult(
    List<AdminCustomerSummaryResult> content, int page, int size, boolean hasNext) {}
