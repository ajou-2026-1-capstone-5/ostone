package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.application.dto.UpsertSlotValueRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/llm-tools/sessions/{sessionId}")
public class LlmToolController {

  private final LlmToolService llmToolService;

  public LlmToolController(LlmToolService llmToolService) {
    this.llmToolService = llmToolService;
  }

  @GetMapping("/context")
  public ResponseEntity<LlmToolContextResponse> getContext(@PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.getContext(sessionId));
  }

  @GetMapping("/slots")
  public ResponseEntity<List<LlmToolSlotResponse>> listSlots(@PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.listSlots(sessionId));
  }

  @GetMapping("/slots/{slotCode}")
  public ResponseEntity<LlmToolSlotResponse> getSlot(
      @PathVariable Long sessionId, @PathVariable String slotCode) {
    return ResponseEntity.ok(llmToolService.getSlot(sessionId, slotCode));
  }

  @PutMapping("/slots/{slotCode}")
  public ResponseEntity<LlmToolSlotValueResponse> upsertSlotValue(
      @PathVariable Long sessionId,
      @PathVariable String slotCode,
      @Valid @RequestBody UpsertSlotValueRequest request) {
    return ResponseEntity.ok(llmToolService.upsertSlotValue(sessionId, slotCode, request.value()));
  }
}
