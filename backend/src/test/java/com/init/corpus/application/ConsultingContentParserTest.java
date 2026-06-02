package com.init.corpus.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.exception.ConsultingContentParseException;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ConsultingContentParserTest {

  @Test
  @DisplayName("상담사 prefix → AGENT 역할, turnIndex 0-based 순서 보장")
  void should_AGENT역할반환_when_상담사prefix() {
    // given
    String content = "상담사: 안녕하세요\n고객: 반갑습니다";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(2);
    TurnData first = result.get(0);
    assertThat(first.speakerRole()).isEqualTo("AGENT");
    assertThat(first.turnIndex()).isEqualTo(0);
    assertThat(first.messageText()).isEqualTo("안녕하세요");
    assertThat(result.get(1).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(1).turnIndex()).isEqualTo(1);
  }

  @Test
  @DisplayName("고객 prefix → CUSTOMER 역할")
  void should_CUSTOMER역할반환_when_고객prefix() {
    // given
    String content = "고객: 안녕하세요";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(0).turnIndex()).isEqualTo(0);
    assertThat(result.get(0).messageText()).isEqualTo("안녕하세요");
  }

  @Test
  @DisplayName("손님 prefix → CUSTOMER 역할")
  void should_CUSTOMER역할반환_when_손님prefix() {
    // given
    String content = "손님: 도움이 필요합니다";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(0).messageText()).isEqualTo("도움이 필요합니다");
  }

  @Test
  @DisplayName("빈 라인은 스킵되고 turnIndex는 연속 부여")
  void should_빈라인스킵_when_빈라인포함() {
    // given
    String content = "상담사: 첫 번째\n\n고객: 두 번째\n\n상담사: 세 번째";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(3);
    assertThat(result.get(0).turnIndex()).isEqualTo(0);
    assertThat(result.get(1).turnIndex()).isEqualTo(1);
    assertThat(result.get(2).turnIndex()).isEqualTo(2);
  }

  @Test
  @DisplayName("null content → ConsultingContentParseException")
  void should_예외발생_when_null콘텐츠() {
    // when & then
    assertThatThrownBy(() -> ConsultingContentParser.parse(null))
        .isInstanceOf(ConsultingContentParseException.class);
  }

  @Test
  @DisplayName("공백만 있는 content → ConsultingContentParseException")
  void should_예외발생_when_공백콘텐츠() {
    // when & then
    assertThatThrownBy(() -> ConsultingContentParser.parse("   "))
        .isInstanceOf(ConsultingContentParseException.class);
  }

  @Test
  @DisplayName("화자 prefix 없는 멀티라인은 직전 turn 의 연속으로 이어 붙인다")
  void should_연속줄이전턴에이어붙임_when_멀티라인turn() {
    // given: 한 고객이 번호 목록으로 여러 줄에 걸쳐 말하는 실제 상담 로그 형태
    String content =
        "상담사: 어떤 일정을 원하시나요?\n"
            + "고객: 아래 두 가지로 부탁드려요.\n"
            + "1. 우붓 파드마 2박\n"
            + "2. 코마네카 케라마스 3박\n"
            + "상담사: 확인 후 안내드리겠습니다.";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then: 연속 줄이 새 화자로 오인되지 않고 고객 turn 에 합쳐진다
    assertThat(result).hasSize(3);
    assertThat(result.get(0).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(1).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(1).messageText())
        .isEqualTo("아래 두 가지로 부탁드려요.\n1. 우붓 파드마 2박\n2. 코마네카 케라마스 3박");
    assertThat(result.get(2).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(2).turnIndex()).isEqualTo(2);
  }

  @Test
  @DisplayName("첫 줄에 화자 prefix가 없으면 CUSTOMER turn 으로 기본 처리한다")
  void should_CUSTOMER기본_when_첫줄prefix없음() {
    // given
    String content = "AGENT: Hello";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(0).messageText()).isEqualTo("AGENT: Hello");
  }

  @Test
  @DisplayName("전각 콜론(：) 구분자도 화자 prefix로 인식한다")
  void should_화자인식_when_전각콜론() {
    // given
    String content = "상담사： 안녕하세요\n고객： 반갑습니다";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(2);
    assertThat(result.get(0).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(0).messageText()).isEqualTo("안녕하세요");
    assertThat(result.get(1).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(1).messageText()).isEqualTo("반갑습니다");
  }

  @Test
  @DisplayName("prefix 변형(상담원/상담직원/고객님/문의자)을 역할로 정규화한다")
  void should_역할정규화_when_prefix변형() {
    // given
    String content = "상담원: 무엇을 도와드릴까요\n고객님: 항공권 문의요\n상담직원: 확인하겠습니다\n문의자: 감사합니다";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(4);
    assertThat(result.get(0).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(1).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(2).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(3).speakerRole()).isEqualTo("CUSTOMER");
  }

  @Test
  @DisplayName("화자 prefix를 포함하지 않는 일반 문장(고객센터 등)은 연속으로 처리되어 오인식되지 않는다")
  void should_오인식없음_when_prefix유사단어() {
    // given: "고객센터" 는 "고객" 으로 시작하지만 콜론이 없으므로 새 화자가 아니다
    String content = "상담사: 고객센터 운영시간을 안내드립니다\n고객센터는 평일 9시부터입니다";

    // when
    List<TurnData> result = ConsultingContentParser.parse(content);

    // then
    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("AGENT");
    assertThat(result.get(0).messageText()).isEqualTo("고객센터 운영시간을 안내드립니다\n고객센터는 평일 9시부터입니다");
  }
}
