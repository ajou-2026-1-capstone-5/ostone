package com.init.fixtures;

import com.init.corpus.application.RawDatasetUploadCommand;
import com.init.corpus.application.RawDatasetUploadCommand.RawConversationInput;
import java.util.List;

public final class Fixtures {

  private Fixtures() {}

  // ── consulting_content samples ──────────────────────────────────────────

  public static String validConsultingContent() {
    return "상담사: 안녕하세요, 무엇을 도와드릴까요?\n고객: 주문 관련 문의가 있습니다.";
  }

  public static String invalidPrefixConsultingContent() {
    return "AGENT: Hello, how can I help?";
  }

  // ── RawConversationInput factory ────────────────────────────────────────

  public static RawConversationInput rawConversationInput() {
    return new RawConversationInput("case-001", "CRM", null, null, null, validConsultingContent());
  }

  // ── RawDatasetUploadCommand factory ────────────────────────────────────

  public static RawDatasetUploadCommand rawDatasetUploadCommand(Long workspaceId, Long userId) {
    return new RawDatasetUploadCommand(
        workspaceId,
        "test-dataset-key",
        "Test Dataset",
        "csv",
        userId,
        List.of(rawConversationInput()));
  }
}
