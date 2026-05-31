package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

@DisplayName("ChatSession")
class ChatSessionTest {

  @Test
  @DisplayName("reopen: RESOLVED → OPEN, assignedCounselorId와 endedAt이 초기화된다")
  void should_clearCounselorAndEndedAt_when_reopen() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.RESOLVED, "WEB", "{}");
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);
    ReflectionTestUtils.setField(session, "endedAt", java.time.OffsetDateTime.now());

    session.reopen();

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.OPEN);
    assertThat(session.getAssignedCounselorId()).isNull();
    assertThat(session.getEndedAt()).isNull();
  }

  @Test
  @DisplayName("reopen: RESOLVED가 아닌 상태 → InvalidSessionStateException")
  void should_throw_when_reopenFromNonResolved() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");

    assertThatThrownBy(session::reopen).isInstanceOf(InvalidSessionStateException.class);
  }

  @Test
  @DisplayName("closeSession: assignedCounselorId가 초기화되고 endedAt이 설정된다")
  void should_clearCounselorAndSetEndedAt_when_closeSession() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.ACTIVE, "WEB", "{}");
    ReflectionTestUtils.setField(session, "assignedCounselorId", 42L);

    session.closeSession();

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.COMPLETED);
    assertThat(session.getAssignedCounselorId()).isNull();
    assertThat(session.getEndedAt()).isNotNull();
  }

  @Test
  @DisplayName("closeSession: RESOLVED 상태에서도 COMPLETED로 전환할 수 있다")
  void should_complete_when_closeSessionFromResolved() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.RESOLVED, "WEB", "{}");

    session.closeSession();

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.COMPLETED);
    assertThat(session.getEndedAt()).isNotNull();
  }

  @Test
  @DisplayName("closeSession: 이미 COMPLETED → InvalidSessionStateException")
  void should_throw_when_closeSessionAlreadyCompleted() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.COMPLETED, "WEB", "{}");

    assertThatThrownBy(session::closeSession).isInstanceOf(InvalidSessionStateException.class);
  }

  @Test
  @DisplayName("closeSession: OPEN 상태에서는 종료할 수 없다")
  void should_throw_when_closeSessionFromOpen() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");

    assertThatThrownBy(session::closeSession).isInstanceOf(InvalidSessionStateException.class);
  }

  @Test
  @DisplayName("create: metaJson이 null이면 빈 JSON 객체로 초기화한다")
  void should_defaultMetaJson_when_createWithNullMetaJson() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", null);

    assertThat(session.getMetaJson()).isEqualTo("{}");
  }
}
