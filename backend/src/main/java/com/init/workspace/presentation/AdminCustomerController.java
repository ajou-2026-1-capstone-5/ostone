package com.init.workspace.presentation;

import com.init.workspace.application.GetAdminCustomerDetailUseCase;
import com.init.workspace.application.GetAdminCustomerListUseCase;
import com.init.workspace.application.WorkspaceFreeOnboardingResult;
import com.init.workspace.application.WorkspaceFreeOnboardingService;
import com.init.workspace.presentation.dto.AdminCustomerDetailResponse;
import com.init.workspace.presentation.dto.AdminCustomerSliceResponse;
import com.init.workspace.presentation.dto.FreeOnboardingRestoreResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/customers")
public class AdminCustomerController {

  private final GetAdminCustomerListUseCase getAdminCustomerListUseCase;
  private final GetAdminCustomerDetailUseCase getAdminCustomerDetailUseCase;
  private final WorkspaceFreeOnboardingService freeOnboardingService;

  public AdminCustomerController(
      GetAdminCustomerListUseCase getAdminCustomerListUseCase,
      GetAdminCustomerDetailUseCase getAdminCustomerDetailUseCase,
      WorkspaceFreeOnboardingService freeOnboardingService) {
    this.getAdminCustomerListUseCase = getAdminCustomerListUseCase;
    this.getAdminCustomerDetailUseCase = getAdminCustomerDetailUseCase;
    this.freeOnboardingService = freeOnboardingService;
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

  @PostMapping("/{workspaceId}/free-onboarding/restore")
  public FreeOnboardingRestoreResponse restoreFreeOnboarding(@PathVariable Long workspaceId) {
    WorkspaceFreeOnboardingResult result = freeOnboardingService.restore(workspaceId);
    return FreeOnboardingRestoreResponse.from(result);
  }
}
