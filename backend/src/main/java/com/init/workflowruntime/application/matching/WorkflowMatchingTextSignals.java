package com.init.workflowruntime.application.matching;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
public class WorkflowMatchingTextSignals {

  private static final Set<String> LEXICAL_STOP_WORDS =
      Set.of(
          "고객",
          "고객님",
          "사용자",
          "문의",
          "문의하고",
          "요청",
          "요청하고",
          "확인",
          "확인하고",
          "처리",
          "처리하고",
          "관련",
          "하고",
          "싶어요",
          "합니다",
          "해주세요",
          "가능",
          "가능한가",
          "어떻게",
          "무엇",
          "무슨",
          "어떤",
          "그럼",
          "그리고",
          "근데",
          "상담",
          "도움",
          "도와주세요",
          "가능한가요",
          "가능해요",
          "user",
          "assistant",
          "system",
          "counselor");
  private static final Set<String> LOW_SIGNAL_TERMS =
      Set.of(
          "안녕", "안녕하세요", "안녕하십니까", "하이", "헬로", "hello", "hi", "네", "넵", "예", "응", "음", "아", "오",
          "와", "감사", "감사합니다", "고마워", "고맙습니다");

  public String nullToEmpty(String value) {
    return value == null ? "" : value;
  }

  public boolean lacksIntentSignal(String latestUserMessage, String conversationContext) {
    String latest = normalizeForMatch(latestUserMessage);
    if (latest.isBlank()) {
      return !hasIntentSignal(conversationContext);
    }
    if (isLowSignalUtterance(latest)) {
      return !hasIntentSignal(conversationContext);
    }
    return !hasIntentSignal(latestUserMessage) && !hasIntentSignal(conversationContext);
  }

  public Set<String> lexicalTokens(String value) {
    Set<String> tokens = new LinkedHashSet<>();
    Arrays.stream(nullToEmpty(value).toLowerCase(Locale.ROOT).split("[^0-9a-z가-힣]+"))
        .filter(token -> token.length() >= 2)
        .filter(token -> !LEXICAL_STOP_WORDS.contains(token))
        .forEach(tokens::add);
    return tokens;
  }

  public String lexicalSearchQuery(String text) {
    return lexicalTokens(text).stream()
        .flatMap(token -> lexicalSearchVariants(token).stream())
        .distinct()
        .limit(12)
        .map(this::quoteWebsearchTerm)
        .reduce((left, right) -> left + " OR " + right)
        .orElse("");
  }

  public Set<String> lexicalSearchVariants(String token) {
    Set<String> variants = new LinkedHashSet<>();
    variants.add(token);
    if (token.endsWith("하고싶어요") && token.length() >= 7) {
      variants.add(token.substring(0, token.length() - 5));
    }
    if (token.endsWith("하고") && token.length() >= 4) {
      variants.add(token.substring(0, token.length() - 2));
    }
    if (token.endsWith("해요") && token.length() >= 4) {
      variants.add(token.substring(0, token.length() - 2));
    }
    if (token.endsWith("합니다") && token.length() >= 5) {
      variants.add(token.substring(0, token.length() - 3));
    }
    return variants;
  }

  public String normalizeForMatch(String value) {
    return nullToEmpty(value)
        .toLowerCase(Locale.ROOT)
        .replaceAll("[^0-9a-z가-힣]+", " ")
        .trim()
        .replaceAll("\\s+", " ");
  }

  private boolean hasIntentSignal(String value) {
    return lexicalTokens(value).stream().anyMatch(token -> !LOW_SIGNAL_TERMS.contains(token));
  }

  private boolean isLowSignalUtterance(String normalizedText) {
    String compact = normalizedText.replace(" ", "");
    if (LOW_SIGNAL_TERMS.contains(compact)) {
      return true;
    }
    Set<String> tokens = rawTokens(normalizedText);
    return !tokens.isEmpty() && tokens.stream().allMatch(LOW_SIGNAL_TERMS::contains);
  }

  private Set<String> rawTokens(String value) {
    Set<String> tokens = new LinkedHashSet<>();
    Arrays.stream(nullToEmpty(value).toLowerCase(Locale.ROOT).split("[^0-9a-z가-힣]+"))
        .filter(token -> !token.isBlank())
        .forEach(tokens::add);
    return tokens;
  }

  private String quoteWebsearchTerm(String term) {
    return "\"" + term.replace("\"", " ") + "\"";
  }
}
