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
  @DisplayName("인식 불가 prefix → ConsultingContentParseException")
  void should_예외발생_when_인식불가prefix() {
    // given
    String content = "AGENT: Hello";

    // when & then
    assertThatThrownBy(() -> ConsultingContentParser.parse(content))
        .isInstanceOf(ConsultingContentParseException.class);
  }
}
