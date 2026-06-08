package com.init.workflowruntime.domain;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("ChatSession")
class ChatSessionTest {

  @Test
  @DisplayName("reopen: RESOLVED → OPEN, assignedCounselorId와 endedAt이 초기화된다")
  void should_clearCounselorAndEndedAt_when_reopen() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    session.assignTo(42L);
    session.resolve();

    session.reopen();

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.OPEN);
    assertThat(session.getAssignedCounselorId()).isNull();
    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ACTIVE);
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
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    session.assignTo(42L);

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

  @Test
  @DisplayName("create: 기본 응대 모드는 AI_ACTIVE이다")
  void should_defaultAiActiveResponseMode_when_create() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");

    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ACTIVE);
    assertThat(session.allowsAiAutoResponse()).isTrue();
  }

  @Test
  @DisplayName("assignTo: 상담사 배정 시 HUMAN_ACTIVE로 전환된다")
  void should_switchHumanActive_when_assignToCounselor() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");

    session.assignTo(42L);

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.ACTIVE);
    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.HUMAN_ACTIVE);
    assertThat(session.allowsAiAutoResponse()).isFalse();
  }

  @Test
  @DisplayName("releaseFrom: 배정 해제 시 AI_ACTIVE로 전환된다")
  void should_switchAiActive_when_releaseFromCounselor() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    session.assignTo(42L);

    session.releaseFrom();

    assertThat(session.getStatus()).isEqualTo(ChatSessionStatus.OPEN);
    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ACTIVE);
  }

  @Test
  @DisplayName("switchResponseMode: AI 보조 모드로 전환하면 자동응답을 허용하지 않는다")
  void should_notAllowAutoResponse_when_assistOnly() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");
    session.assignTo(42L);

    session.switchResponseMode(ChatSessionResponseMode.AI_ASSIST_ONLY);

    assertThat(session.getResponseMode()).isEqualTo(ChatSessionResponseMode.AI_ASSIST_ONLY);
    assertThat(session.allowsAiAutoResponse()).isFalse();
  }

  @Test
  @DisplayName("switchResponseMode: 상담사 모드는 배정 상담사가 필요하다")
  void should_throw_when_switchingHumanModeWithoutAssignedCounselor() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.OPEN, "WEB", "{}");

    assertThatThrownBy(() -> session.switchResponseMode(ChatSessionResponseMode.HUMAN_ACTIVE))
        .isInstanceOf(InvalidSessionStateException.class)
        .hasMessageContaining("requires an assigned counselor");
  }

  @Test
  @DisplayName("switchResponseMode: 종료된 세션은 응대 모드를 변경할 수 없다")
  void should_throw_when_switchingResponseModeForClosedSession() {
    ChatSession session = ChatSession.create(1L, 1L, ChatSessionStatus.COMPLETED, "WEB", "{}");

    assertThatThrownBy(() -> session.switchResponseMode(ChatSessionResponseMode.AI_ACTIVE))
        .isInstanceOf(InvalidSessionStateException.class)
        .hasMessageContaining("requires an open or active session");
  }
}
