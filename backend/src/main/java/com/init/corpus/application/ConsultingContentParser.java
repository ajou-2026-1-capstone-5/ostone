package com.init.corpus.application;

import com.init.corpus.application.DatasetUploadCommand.TurnData;
import com.init.corpus.application.exception.ConsultingContentParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * consulting_content 필드를 TurnData 목록으로 파싱합니다.
 *
 * <p>파싱 규칙:
 *
 * <ul>
 *   <li>화자 prefix(아래)로 시작하는 줄 → 새 turn 시작. AGENT prefix → "AGENT", CUSTOMER prefix → "CUSTOMER".
 *   <li>화자 prefix가 없는 비어있지 않은 줄 → 직전 turn 의 연속(continuation)으로 이어 붙인다. 실제 상담 로그는 한 화자가 번호 목록·견적
 *       항목·날짜 등으로 여러 줄에 걸쳐 말하는 멀티라인 turn 을 포함하므로, 연속 줄을 새 화자로 오인하거나 예외로 처리하지 않는다(ML ingestion stage
 *       와 동일한 의미).
 *   <li>첫 줄부터 화자 prefix가 없으면 해당 내용은 CUSTOMER turn 으로 기본 처리한다.
 *   <li>빈 라인 → 스킵.
 *   <li>content 가 null/blank 이거나 파싱 결과 turn 이 0개일 때만 ConsultingContentParseException(→ 400).
 * </ul>
 *
 * <p>화자 prefix 는 반각 콜론(:)과 전각 콜론(：) 구분자를 모두 인식하며, 다음 표기 변형을 지원한다.
 *
 * <ul>
 *   <li>AGENT: 상담사, 상담원, 상담직원, 직원, 상담
 *   <li>CUSTOMER: 고객, 고객님, 손님, 문의자
 * </ul>
 *
 * turnIndex 는 0-based 로 자동 부여. eventTime 은 이 파서에서 항상 null(입력 텍스트에 타임스탬프 없음).
 */
class ConsultingContentParser {

  private static final String AGENT_ROLE = "AGENT";
  private static final String CUSTOMER_ROLE = "CUSTOMER";

  // 변형이 긴 것부터 검사해 "상담사" 가 "상담" 으로 잘못 매칭되지 않도록 한다.
  private static final List<String> AGENT_PREFIXES = List.of("상담직원", "상담사", "상담원", "직원", "상담");
  private static final List<String> CUSTOMER_PREFIXES = List.of("고객님", "고객", "손님", "문의자");

  private ConsultingContentParser() {}

  static List<TurnData> parse(String consultingContent) {
    if (consultingContent == null || consultingContent.isBlank()) {
      throw new ConsultingContentParseException("consulting_content가 비어 있습니다.");
    }

    List<TurnData> turns = new ArrayList<>();
    String[] lines = consultingContent.split("\\r?\\n");

    String currentRole = null;
    StringBuilder currentText = new StringBuilder();

    for (String raw : lines) {
      String line = raw.strip();
      if (line.isEmpty()) {
        continue;
      }

      RolePrefixMatch match = matchRolePrefix(line);
      if (match != null) {
        flush(turns, currentRole, currentText);
        currentRole = match.role();
        currentText = new StringBuilder(match.text());
      } else {
        // 화자 prefix 가 없는 줄: 직전 turn 의 연속. 첫 줄이면 CUSTOMER 로 기본 처리한다.
        if (currentRole == null) {
          currentRole = CUSTOMER_ROLE;
        }
        if (currentText.length() > 0) {
          currentText.append('\n');
        }
        currentText.append(line);
      }
    }
    flush(turns, currentRole, currentText);

    if (turns.isEmpty()) {
      throw new ConsultingContentParseException("파싱 결과 턴이 없습니다. consulting_content를 확인해주세요.");
    }

    return List.copyOf(turns);
  }

  private static void flush(List<TurnData> turns, String role, StringBuilder text) {
    if (role == null) {
      return;
    }
    String message = text.toString().strip();
    if (message.isEmpty()) {
      return;
    }
    turns.add(new TurnData(turns.size(), role, message, null));
  }

  /**
   * 줄이 화자 prefix 로 시작하면 (역할, prefix 이후 텍스트)를 반환하고, 아니면 null. prefix 와 본문 사이의 구분자는 반각/전각 콜론만 인정한다(목록
   * 마커 ')' 나 날짜 범위 '-' 를 화자 구분자로 오인하지 않기 위함).
   */
  private static RolePrefixMatch matchRolePrefix(String line) {
    String agentText = stripPrefix(line, AGENT_PREFIXES);
    if (agentText != null) {
      return new RolePrefixMatch(AGENT_ROLE, agentText);
    }
    String customerText = stripPrefix(line, CUSTOMER_PREFIXES);
    if (customerText != null) {
      return new RolePrefixMatch(CUSTOMER_ROLE, customerText);
    }
    return null;
  }

  private static String stripPrefix(String line, List<String> prefixes) {
    for (String prefix : prefixes) {
      if (!line.startsWith(prefix)) {
        continue;
      }
      String remainder = line.substring(prefix.length()).stripLeading();
      if (!remainder.isEmpty() && isSeparator(remainder.charAt(0))) {
        return remainder.substring(1).strip();
      }
    }
    return null;
  }

  private static boolean isSeparator(char ch) {
    return ch == ':' || ch == '：';
  }

  private record RolePrefixMatch(String role, String text) {}
}
