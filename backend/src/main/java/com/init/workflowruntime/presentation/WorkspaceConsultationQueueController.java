package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/consultation")
public class WorkspaceConsultationQueueController {

  private final ConsultationService consultationService;

  public WorkspaceConsultationQueueController(ConsultationService consultationService) {
    this.consultationService = consultationService;
  }

  @GetMapping("/queue")
  public ResponseEntity<List<ChatSessionResponse>> getQueue(
      @PathVariable Long workspaceId, Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(consultationService.getActiveQueue(workspaceId, userId));
  }
}
