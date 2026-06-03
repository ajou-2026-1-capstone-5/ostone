package com.init.workspace.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.shared.application.exception.BadRequestException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("GetAdminCustomerListUseCase")
class GetAdminCustomerListUseCaseTest {

  @Mock private AdminCustomerQueryPort adminCustomerQueryPort;

  private GetAdminCustomerListUseCase useCase;

  @BeforeEach
  void setUp() {
    useCase = new GetAdminCustomerListUseCase(adminCustomerQueryPort);
  }

  @Test
  @DisplayName("execute: 검색어와 상태를 정규화해 고객사 slice를 조회한다")
  void should_고객사Slice조회_when_검색어와상태전달() {
    given(adminCustomerQueryPort.findCustomers(org.mockito.ArgumentMatchers.any()))
        .willReturn(new AdminCustomerSliceResult(List.of(), 1, 10, false));

    AdminCustomerSliceResult result = useCase.execute(" acme ", " active ", 1, 10);

    ArgumentCaptor<AdminCustomerListQuery> captor =
        ArgumentCaptor.forClass(AdminCustomerListQuery.class);
    verify(adminCustomerQueryPort).findCustomers(captor.capture());
    assertThat(captor.getValue()).isEqualTo(new AdminCustomerListQuery("acme", "ACTIVE", 1, 10));
    assertThat(result.page()).isEqualTo(1);
  }

  @Test
  @DisplayName("execute: 잘못된 workspace status → INVALID_WORKSPACE_STATUS")
  void should_INVALID_WORKSPACE_STATUS_when_지원하지않는상태() {
    assertThatThrownBy(() -> useCase.execute(null, "SUSPENDED", 0, 20))
        .isInstanceOf(BadRequestException.class)
        .hasMessageContaining("SUSPENDED");
  }

  @Test
  @DisplayName("execute: size 범위 초과 → INVALID_PAGE_SIZE")
  void should_INVALID_PAGE_SIZE_when_size범위초과() {
    assertThatThrownBy(() -> useCase.execute(null, null, 0, 101))
        .isInstanceOf(BadRequestException.class)
        .extracting("code")
        .isEqualTo("INVALID_PAGE_SIZE");
  }
}
