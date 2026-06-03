package com.init.workspace.presentation;

import com.init.workspace.application.GetAdminCustomerDetailUseCase;
import com.init.workspace.application.GetAdminCustomerListUseCase;
import com.init.workspace.presentation.dto.AdminCustomerDetailResponse;
import com.init.workspace.presentation.dto.AdminCustomerSliceResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/customers")
public class AdminCustomerController {

  private final GetAdminCustomerListUseCase getAdminCustomerListUseCase;
  private final GetAdminCustomerDetailUseCase getAdminCustomerDetailUseCase;

  public AdminCustomerController(
      GetAdminCustomerListUseCase getAdminCustomerListUseCase,
      GetAdminCustomerDetailUseCase getAdminCustomerDetailUseCase) {
    this.getAdminCustomerListUseCase = getAdminCustomerListUseCase;
    this.getAdminCustomerDetailUseCase = getAdminCustomerDetailUseCase;
  }

  @GetMapping
  public AdminCustomerSliceResponse list(
      @RequestParam(required = false) String q,
      @RequestParam(required = false) String status,
      @RequestParam(required = false) Integer page,
      @RequestParam(required = false) Integer size) {
    return AdminCustomerSliceResponse.from(
        getAdminCustomerListUseCase.execute(q, status, page, size));
  }

  @GetMapping("/{workspaceId}")
  public AdminCustomerDetailResponse detail(@PathVariable Long workspaceId) {
    return AdminCustomerDetailResponse.from(getAdminCustomerDetailUseCase.execute(workspaceId));
  }
}
