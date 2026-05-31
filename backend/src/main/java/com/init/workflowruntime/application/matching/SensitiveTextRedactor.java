package com.init.workflowruntime.application.matching;

import java.util.Locale;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class SensitiveTextRedactor {

  private static final Pattern EMAIL =
      Pattern.compile("[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}", Pattern.CASE_INSENSITIVE);
  private static final Pattern PHONE =
      Pattern.compile("(?<!\\d)(?:\\+?82[-\\s]?)?0?1[016789][-\\s]?\\d{3,4}[-\\s]?\\d{4}(?!\\d)");
  private static final Pattern ORDER =
      Pattern.compile("(?iu)\\b(?:ord|order|주문)[-_:\\s]*[A-Z0-9-]{6,}\\b");

  public String redact(String value) {
    String redacted = value == null ? "" : value;
    redacted = EMAIL.matcher(redacted).replaceAll("[EMAIL]");
    redacted = PHONE.matcher(redacted).replaceAll("[PHONE]");
    redacted = ORDER.matcher(redacted).replaceAll("[ORDER]");
    return redacted.trim().toLowerCase(Locale.ROOT);
  }
}
