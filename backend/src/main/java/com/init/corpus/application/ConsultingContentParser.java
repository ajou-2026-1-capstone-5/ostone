package com.init.corpus.application;

import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.exception.ConsultingContentParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * consulting_content 필드를 TurnData 목록으로 파싱합니다.
 *
 * <p>파싱 규칙 (D-7):
 *
 * <ul>
 *   <li>"상담사:" prefix → speakerRole = "AGENT"
 *   <li>"고객:" prefix → speakerRole = "CUSTOMER"
 *   <li>"손님:" prefix → speakerRole = "CUSTOMER"
 *   <li>빈 라인 → 스킵
 *   <li>인식 불가 prefix → ConsultingContentParseException (→ 400)
 * </ul>
 *
 * turnIndex는 0-based로 자동 부여. eventTime은 이 파서에서 항상 null (입력 텍스트에
 * 타임스탬프 없음). channel은 TurnData 필드가 아니며 ConversationData 레벨에서 관리된다.
 */
class ConsultingContentParser {

  private static final String AGENT_PREFIX = "상담사:";
  private static final String CUSTOMER_PREFIX_GAEEK = "고객:";
  private static final String CUSTOMER_PREFIX_SONNIM = "손님:";

  private ConsultingContentParser() {}

  static List<TurnData> parse(String consultingContent) {
    if (consultingContent == null || consultingContent.isBlank()) {
      throw new ConsultingContentParseException("consulting_content가 비어 있습니다.");
    }

    List<TurnData> turns = new ArrayList<>();
    String[] lines = consultingContent.split("\\r?\\n");
    int turnIndex = 0;
    int lineNumber = 0;

    for (String raw : lines) {
      lineNumber++;
      String line = raw.strip();
      if (line.isEmpty()) {
        continue;
      }

      if (line.startsWith(AGENT_PREFIX)) {
        String text = line.substring(AGENT_PREFIX.length()).strip();
        turns.add(new TurnData(turnIndex++, "AGENT", text, null));
      } else if (line.startsWith(CUSTOMER_PREFIX_GAEEK)) {
        String text = line.substring(CUSTOMER_PREFIX_GAEEK.length()).strip();
        turns.add(new TurnData(turnIndex++, "CUSTOMER", text, null));
      } else if (line.startsWith(CUSTOMER_PREFIX_SONNIM)) {
        String text = line.substring(CUSTOMER_PREFIX_SONNIM.length()).strip();
        turns.add(new TurnData(turnIndex++, "CUSTOMER", text, null));
      } else {
        throw new ConsultingContentParseException(
            "인식할 수 없는 화자 prefix입니다. (line=" + lineNumber + ", length=" + line.length() + ")");
      }
    }

    if (turns.isEmpty()) {
      throw new ConsultingContentParseException("파싱 결과 턴이 없습니다. consulting_content를 확인해주세요.");
    }

    return turns;
  }
}
