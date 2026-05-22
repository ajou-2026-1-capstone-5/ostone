package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.command.GetLlmToolContextCommand;
import com.init.workflowruntime.application.command.GetLlmToolSlotCommand;
import com.init.workflowruntime.application.command.ListLlmToolIntentsCommand;
import com.init.workflowruntime.application.command.ListLlmToolSlotsCommand;
import com.init.workflowruntime.application.command.SelectLlmToolIntentCommand;
import com.init.workflowruntime.application.command.UpsertLlmToolSlotValueCommand;
import com.init.workflowruntime.application.dto.LlmToolContextResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentResponse;
import com.init.workflowruntime.application.dto.LlmToolIntentSelectionResponse;
import com.init.workflowruntime.application.dto.LlmToolPolicyContextResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotResponse;
import com.init.workflowruntime.application.dto.LlmToolSlotValueResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SelectIntentRequest;
import com.init.workflowruntime.application.dto.UpsertSlotValueRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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

  @GetMapping("/workflow")
  public ResponseEntity<LlmToolWorkflowResponse> getCurrentWorkflow(@PathVariable Long sessionId) {
    return ResponseEntity.ok(
        llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(sessionId)));
  }

  @GetMapping("/context")
  public ResponseEntity<LlmToolContextResponse> getContext(@PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.getContext(new GetLlmToolContextCommand(sessionId)));
  }

  @GetMapping("/policy-context")
  public ResponseEntity<LlmToolPolicyContextResponse> getPolicyContext(
      @PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.getPolicyContext(sessionId));
  }

  @GetMapping("/slots")
  public ResponseEntity<List<LlmToolSlotResponse>> listSlots(@PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.listSlots(new ListLlmToolSlotsCommand(sessionId)));
  }

  @GetMapping("/slots/{slotCode}")
  public ResponseEntity<LlmToolSlotResponse> getSlot(
      @PathVariable Long sessionId, @PathVariable String slotCode) {
    return ResponseEntity.ok(
        llmToolService.getSlot(new GetLlmToolSlotCommand(sessionId, slotCode)));
  }

  @GetMapping("/intents")
  public ResponseEntity<List<LlmToolIntentResponse>> listIntents(@PathVariable Long sessionId) {
    return ResponseEntity.ok(llmToolService.listIntents(new ListLlmToolIntentsCommand(sessionId)));
  }

  @PostMapping("/intent-selection")
  public ResponseEntity<LlmToolIntentSelectionResponse> selectIntent(
      @PathVariable Long sessionId, @Valid @RequestBody SelectIntentRequest request) {
    return ResponseEntity.ok(
        llmToolService.selectIntent(
            new SelectLlmToolIntentCommand(sessionId, request.intentCode())));
  }

  @PutMapping("/slots/{slotCode}")
  public ResponseEntity<LlmToolSlotValueResponse> upsertSlotValue(
      @PathVariable Long sessionId,
      @PathVariable String slotCode,
      @Valid @RequestBody UpsertSlotValueRequest request) {
    return ResponseEntity.ok(
        llmToolService.upsertSlotValue(
            new UpsertLlmToolSlotValueCommand(sessionId, slotCode, request.value())));
  }
}
