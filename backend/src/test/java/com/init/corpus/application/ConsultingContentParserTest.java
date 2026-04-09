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
  void parse_agentPrefix_returnsAgentTurnWithCorrectIndex() {
    String content = "상담사: 안녕하세요\n고객: 반갑습니다";

    List<TurnData> result = ConsultingContentParser.parse(content);

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
  void parse_customerGaekPrefix_returnsCustomerTurnData() {
    String content = "고객: 안녕하세요";

    List<TurnData> result = ConsultingContentParser.parse(content);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(0).turnIndex()).isEqualTo(0);
    assertThat(result.get(0).messageText()).isEqualTo("안녕하세요");
  }

  @Test
  @DisplayName("손님 prefix → CUSTOMER 역할")
  void parse_customerSonnimPrefix_returnsCustomerTurnData() {
    String content = "손님: 도움이 필요합니다";

    List<TurnData> result = ConsultingContentParser.parse(content);

    assertThat(result).hasSize(1);
    assertThat(result.get(0).speakerRole()).isEqualTo("CUSTOMER");
    assertThat(result.get(0).messageText()).isEqualTo("도움이 필요합니다");
  }

  @Test
  @DisplayName("빈 라인은 스킵되고 turnIndex는 연속 부여")
  void parse_emptyLinesSkipped_turnIndexContinuous() {
    String content = "상담사: 첫 번째\n\n고객: 두 번째\n\n상담사: 세 번째";

    List<TurnData> result = ConsultingContentParser.parse(content);

    assertThat(result).hasSize(3);
    assertThat(result.get(0).turnIndex()).isEqualTo(0);
    assertThat(result.get(1).turnIndex()).isEqualTo(1);
    assertThat(result.get(2).turnIndex()).isEqualTo(2);
  }

  @Test
  @DisplayName("null content → ConsultingContentParseException")
  void parse_nullContent_throwsException() {
    assertThatThrownBy(() -> ConsultingContentParser.parse(null))
        .isInstanceOf(ConsultingContentParseException.class);
  }

  @Test
  @DisplayName("공백만 있는 content → ConsultingContentParseException")
  void parse_blankContent_throwsException() {
    assertThatThrownBy(() -> ConsultingContentParser.parse("   "))
        .isInstanceOf(ConsultingContentParseException.class);
  }

  @Test
  @DisplayName("인식 불가 prefix → ConsultingContentParseException")
  void parse_unrecognizedPrefix_throwsException() {
    String content = "AGENT: Hello";

    assertThatThrownBy(() -> ConsultingContentParser.parse(content))
        .isInstanceOf(ConsultingContentParseException.class);
  }
}
