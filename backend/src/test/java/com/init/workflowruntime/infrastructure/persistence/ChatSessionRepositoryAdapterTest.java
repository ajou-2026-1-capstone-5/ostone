package com.init.workflowruntime.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

import com.init.workflowruntime.domain.ChatSession;
import com.init.workflowruntime.domain.ChatSessionStatus;
import com.init.workflowruntime.domain.DomainPage;
import com.init.workflowruntime.domain.DomainPageRequest;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

@ExtendWith(MockitoExtension.class)
@DisplayName("ChatSessionRepositoryAdapter")
class ChatSessionRepositoryAdapterTest {

  @Mock private JpaChatSessionRepository jpaRepository;

  @Test
  @DisplayName(
      "findByWorkspaceIdAndChannelOrderByStartedAtDesc: channel과 page 요청을 JPA repository로 위임한다")
  void should_delegateSimulationChannelPage() {
    ChatSession session =
        withId(ChatSession.create(10L, 20L, ChatSessionStatus.OPEN, "SIMULATION", "{}"), 55L);
    PageRequest expectedPageRequest = PageRequest.of(0, 30);
    given(
            jpaRepository.findByWorkspaceIdAndChannelOrderByStartedAtDesc(
                10L, "SIMULATION", expectedPageRequest))
        .willReturn(new PageImpl<>(List.of(session), expectedPageRequest, 31));
    ChatSessionRepositoryAdapter adapter = new ChatSessionRepositoryAdapter(jpaRepository);

    DomainPage<ChatSession> page =
        adapter.findByWorkspaceIdAndChannelOrderByStartedAtDesc(
            10L, "SIMULATION", new DomainPageRequest(0, 30));

    assertThat(page.content()).containsExactly(session);
    assertThat(page.page()).isZero();
    assertThat(page.size()).isEqualTo(30);
    assertThat(page.totalElements()).isEqualTo(31);
    assertThat(page.totalPages()).isEqualTo(2);
  }

  @Test
  @DisplayName("findFirstByWorkspaceIdAndStartedBy...: reusable 운영 세션 조회에서 SIMULATION 채널을 제외한다")
  void should_excludeSimulationChannel_when_findingReusableSession() {
    ChatSession session =
        withId(ChatSession.create(10L, 20L, ChatSessionStatus.OPEN, "WEB", "{}"), 55L);
    List<ChatSessionStatus> statuses = List.of(ChatSessionStatus.OPEN, ChatSessionStatus.ACTIVE);
    given(
            jpaRepository
                .findFirstByWorkspaceIdAndStartedByAndStatusInAndChannelNotOrderByStartedAtDescIdDesc(
                    10L, 7L, statuses, "SIMULATION"))
        .willReturn(Optional.of(session));
    ChatSessionRepositoryAdapter adapter = new ChatSessionRepositoryAdapter(jpaRepository);

    Optional<ChatSession> result =
        adapter.findFirstByWorkspaceIdAndStartedByAndStatusInOrderByStartedAtDescIdDesc(
            10L, 7L, statuses);

    assertThat(result).contains(session);
    ArgumentCaptor<String> channelCaptor = ArgumentCaptor.forClass(String.class);
    verify(jpaRepository)
        .findFirstByWorkspaceIdAndStartedByAndStatusInAndChannelNotOrderByStartedAtDescIdDesc(
            org.mockito.ArgumentMatchers.eq(10L),
            org.mockito.ArgumentMatchers.eq(7L),
            org.mockito.ArgumentMatchers.eq(statuses),
            channelCaptor.capture());
    assertThat(channelCaptor.getValue()).isEqualTo("SIMULATION");
  }

  private ChatSession withId(ChatSession session, Long id) {
    ReflectionTestUtils.setField(session, "id", id);
    return session;
  }
}
