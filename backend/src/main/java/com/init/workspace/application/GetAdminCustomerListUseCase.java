package com.init.workspace.application;

import com.init.shared.application.exception.BadRequestException;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class GetAdminCustomerListUseCase {

  private static final int DEFAULT_PAGE_SIZE = 20;
  private static final int MAX_PAGE_SIZE = 100;
  private static final Set<String> WORKSPACE_STATUSES = Set.of("ACTIVE", "ARCHIVED");

  private final AdminCustomerQueryPort adminCustomerQueryPort;

  public GetAdminCustomerListUseCase(AdminCustomerQueryPort adminCustomerQueryPort) {
    this.adminCustomerQueryPort = adminCustomerQueryPort;
  }

  public AdminCustomerSliceResult execute(
      String search, String status, Integer page, Integer size) {
    int normalizedPage = page == null ? 0 : page;
    int normalizedSize = size == null ? DEFAULT_PAGE_SIZE : size;
    if (normalizedPage < 0) {
      throw new BadRequestException("INVALID_PAGE", "page는 0 이상이어야 합니다.");
    }
    if (normalizedSize < 1 || normalizedSize > MAX_PAGE_SIZE) {
      throw new BadRequestException("INVALID_PAGE_SIZE", "size는 1 이상 100 이하이어야 합니다.");
    }
    String normalizedSearch = normalizeSearch(search);
    String normalizedStatus = normalizeStatus(status);
    return adminCustomerQueryPort.findCustomers(
        new AdminCustomerListQuery(
            normalizedSearch, normalizedStatus, normalizedPage, normalizedSize));
  }

  private String normalizeSearch(String search) {
    if (search == null || search.isBlank()) {
      return null;
    }
    return search.trim();
  }

  private String normalizeStatus(String status) {
    if (status == null || status.isBlank()) {
      return null;
    }
    String normalized = status.trim().toUpperCase(Locale.ROOT);
    if (!WORKSPACE_STATUSES.contains(normalized)) {
      throw new BadRequestException(
          "INVALID_WORKSPACE_STATUS", "지원하지 않는 workspace status입니다: " + status);
    }
    return normalized;
  }
}
