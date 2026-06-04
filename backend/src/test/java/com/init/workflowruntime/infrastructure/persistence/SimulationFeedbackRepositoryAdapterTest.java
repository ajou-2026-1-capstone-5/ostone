package com.init.workflowruntime.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import com.init.workflowruntime.domain.SimulationFeedback;
import com.init.workflowruntime.domain.SimulationFeedbackContent;
import com.init.workflowruntime.domain.SimulationFeedbackSeverity;
import com.init.workflowruntime.domain.SimulationFeedbackStatus;
import com.init.workflowruntime.domain.SimulationFeedbackType;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

@ExtendWith(MockitoExtension.class)
@DisplayName("SimulationFeedbackRepositoryAdapter")
class SimulationFeedbackRepositoryAdapterTest {

  @Mock private JpaSimulationFeedbackRepository jpaRepository;

  @Test
  @DisplayName("findByWorkspaceId: workspace feedback 페이지를 도메인 페이지로 변환한다")
  void shouldFindFeedbackByWorkspace() {
    SimulationFeedback feedback = feedback();
    PageRequest expectedPageRequest = PageRequest.of(1, 10);
    given(jpaRepository.findByWorkspaceIdOrderByCreatedAtDesc(10L, expectedPageRequest))
        .willReturn(new PageImpl<>(List.of(feedback), expectedPageRequest, 21));
    SimulationFeedbackRepositoryAdapter adapter =
        new SimulationFeedbackRepositoryAdapter(jpaRepository);

    DomainPage<SimulationFeedback> page =
        adapter.findByWorkspaceId(10L, new DomainPageRequest(1, 10));

    assertThat(page.content()).containsExactly(feedback);
    assertThat(page.page()).isEqualTo(1);
    assertThat(page.size()).isEqualTo(10);
    assertThat(page.totalElements()).isEqualTo(21);
    assertThat(page.totalPages()).isEqualTo(3);
  }

  @Test
  @DisplayName("findByWorkspaceIdAndStatus: status 필터를 JPA repository로 위임한다")
  void shouldFindFeedbackByWorkspaceAndStatus() {
    SimulationFeedback feedback = feedback();
    PageRequest expectedPageRequest = PageRequest.of(0, 20);
    given(
            jpaRepository.findByWorkspaceIdAndStatusOrderByCreatedAtDesc(
                10L, SimulationFeedbackStatus.OPEN, expectedPageRequest))
        .willReturn(new PageImpl<>(List.of(feedback), expectedPageRequest, 1));
    SimulationFeedbackRepositoryAdapter adapter =
        new SimulationFeedbackRepositoryAdapter(jpaRepository);

    DomainPage<SimulationFeedback> page =
        adapter.findByWorkspaceIdAndStatus(
            10L, SimulationFeedbackStatus.OPEN, new DomainPageRequest(0, 20));

    assertThat(page.content()).containsExactly(feedback);
    assertThat(page.totalElements()).isEqualTo(1);
  }

  @Test
  @DisplayName("save/findByChatSessionId...: JPA repository에 단순 위임한다")
  void shouldDelegateSaveAndSessionLookup() {
    SimulationFeedback feedback = feedback();
    given(jpaRepository.save(feedback)).willReturn(feedback);
    given(jpaRepository.findByChatSessionIdOrderByCreatedAtAsc(55L)).willReturn(List.of(feedback));
    SimulationFeedbackRepositoryAdapter adapter =
        new SimulationFeedbackRepositoryAdapter(jpaRepository);

    assertThat(adapter.save(feedback)).isSameAs(feedback);
    assertThat(adapter.findByChatSessionIdOrderByCreatedAtAsc(55L)).containsExactly(feedback);
  }

  private SimulationFeedback feedback() {
    return SimulationFeedback.create(
        10L,
        55L,
        100L,
        new SimulationFeedbackContent(
            SimulationFeedbackType.MISSING_SLOT_QUESTION,
            "주문번호를 묻지 않았습니다.",
            "주문번호를 먼저 요청합니다.",
            SimulationFeedbackSeverity.HIGH),
        7L);
  }
}
