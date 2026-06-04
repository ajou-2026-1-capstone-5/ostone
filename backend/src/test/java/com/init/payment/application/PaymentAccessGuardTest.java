package com.init.payment.application;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

import com.init.payment.application.exception.PaymentWorkspaceAccessDeniedException;
import com.init.payment.application.exception.PaymentWorkspaceNotFoundException;
import com.init.payment.application.port.WorkspaceMembershipPort;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentAccessGuard")
class PaymentAccessGuardTest {

  @Mock private WorkspaceMembershipPort workspaceMembershipPort;

  private PaymentAccessGuard guard;

  @BeforeEach
  void setUp() {
    guard = new PaymentAccessGuard(workspaceMembershipPort);
  }

  @Test
  @DisplayName("워크스페이스가 없으면 PaymentWorkspaceNotFoundException을 던진다")
  void requireMember_workspaceNotFound_throws() {
    given(workspaceMembershipPort.existsById(99L)).willReturn(false);

    assertThatThrownBy(() -> guard.requireMember(99L, 1L))
        .isInstanceOf(PaymentWorkspaceNotFoundException.class);
  }

  @Test
  @DisplayName("멤버십이 없거나 허용 역할이 아니면 PaymentWorkspaceAccessDeniedException을 던진다")
  void requireMember_notAllowedRole_throws() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN", "OPERATOR")))
        .willReturn(false);

    assertThatThrownBy(() -> guard.requireMember(1L, 99L))
        .isInstanceOf(PaymentWorkspaceAccessDeniedException.class);
  }

  @Test
  @DisplayName("워크스페이스 존재 + 허용 역할이면 통과한다")
  void requireMember_validMember_passes() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN", "OPERATOR")))
        .willReturn(true);

    assertThatCode(() -> guard.requireMember(1L, 99L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("billing overview 관리 권한은 OWNER/ADMIN만 통과한다")
  void requireBillingManager_ownerOrAdmin_passes() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN"))).willReturn(true);

    assertThatCode(() -> guard.requireBillingManager(1L, 99L)).doesNotThrowAnyException();
  }

  @Test
  @DisplayName("billing overview는 OPERATOR 역할이면 거부한다")
  void requireBillingManager_operator_throws() {
    given(workspaceMembershipPort.existsById(1L)).willReturn(true);
    given(workspaceMembershipPort.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN"))).willReturn(false);

    assertThatThrownBy(() -> guard.requireBillingManager(1L, 99L))
        .isInstanceOf(PaymentWorkspaceAccessDeniedException.class);
  }
}
