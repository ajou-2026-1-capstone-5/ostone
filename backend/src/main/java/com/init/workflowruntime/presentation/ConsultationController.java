package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.application.dto.UpdateStatusRequest;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/consultation")
public class ConsultationController {

  private final ConsultationService consultationService;

  public ConsultationController(ConsultationService consultationService) {
    this.consultationService = consultationService;
  }

  @GetMapping("/queue")
  public ResponseEntity<List<ChatSessionResponse>> getActiveQueue() {
    return ResponseEntity.ok(consultationService.getActiveQueue());
  }

  @GetMapping("/sessions/{sessionId}/messages")
  public ResponseEntity<List<ChatMessageResponse>> getMessages(@PathVariable Long sessionId) {
    return ResponseEntity.ok(consultationService.getMessages(sessionId));
  }

  @PostMapping("/sessions/{sessionId}/messages")
  public ResponseEntity<ChatMessageResponse> sendMessage(
      @PathVariable Long sessionId,
      @RequestBody SendMessageRequest request) {
    return ResponseEntity.ok(consultationService.sendMessage(sessionId, request));
  }

  @PatchMapping("/sessions/{sessionId}/status")
  public ResponseEntity<ChatSessionResponse> updateStatus(
      @PathVariable Long sessionId,
      @RequestBody UpdateStatusRequest request) {
    return ResponseEntity.ok(consultationService.updateSessionStatus(sessionId, request.getStatus()));
  }
}
