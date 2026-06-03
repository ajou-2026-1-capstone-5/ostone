package com.init.payment.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.workspace.domain.model.WorkspaceMember;
import com.init.workspace.domain.model.WorkspaceMemberRole;
import com.init.workspace.domain.repository.WorkspaceMemberRepository;
import com.init.workspace.domain.repository.WorkspaceRepository;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
@DisplayName("PaymentWorkspaceMembershipAdapter")
class PaymentWorkspaceMembershipAdapterTest {

  @Mock private WorkspaceRepository workspaceRepository;
  @Mock private WorkspaceMemberRepository workspaceMemberRepository;

  private PaymentWorkspaceMembershipAdapter adapter;

  @BeforeEach
  void setUp() {
    adapter = new PaymentWorkspaceMembershipAdapter(workspaceRepository, workspaceMemberRepository);
  }

  @Test
  @DisplayName("existsById는 WorkspaceRepository에 위임한다")
  void existsById_delegates() {
    given(workspaceRepository.existsById(1L)).willReturn(true);

    assertThat(adapter.existsById(1L)).isTrue();
  }

  @Test
  @DisplayName("hasAnyRole — 멤버 존재 + 허용 역할이면 true")
  void hasAnyRole_allowedRole_returnsTrue() {
    WorkspaceMember member = WorkspaceMember.create(1L, 99L, WorkspaceMemberRole.OWNER);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 99L))
        .willReturn(Optional.of(member));

    boolean result = adapter.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN"));

    assertThat(result).isTrue();
  }

  @Test
  @DisplayName("hasAnyRole — 멤버 존재 + 허용되지 않은 역할이면 false")
  void hasAnyRole_disallowedRole_returnsFalse() {
    WorkspaceMember member = WorkspaceMember.create(1L, 99L, WorkspaceMemberRole.REVIEWER);
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 99L))
        .willReturn(Optional.of(member));

    boolean result = adapter.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN"));

    assertThat(result).isFalse();
  }

  @Test
  @DisplayName("hasAnyRole — 멤버 미존재이면 false")
  void hasAnyRole_memberNotFound_returnsFalse() {
    given(workspaceMemberRepository.findByWorkspaceIdAndUserId(1L, 99L))
        .willReturn(Optional.empty());

    boolean result = adapter.hasAnyRole(1L, 99L, Set.of("OWNER", "ADMIN"));

    assertThat(result).isFalse();
  }
}
