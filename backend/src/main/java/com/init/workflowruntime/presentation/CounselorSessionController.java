package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.CounselorService;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class CounselorSessionController {

  private final CounselorService counselorService;

  public CounselorSessionController(CounselorService counselorService) {
    this.counselorService = counselorService;
  }

  @PostMapping("/consultation/sessions/{sessionId}/assign")
  public ResponseEntity<CounselorSessionResponse> assignSession(
      @PathVariable Long sessionId, Authentication authentication) {
    Long counselorId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(counselorService.assignSession(sessionId, counselorId));
  }

  @PostMapping("/consultation/sessions/{sessionId}/release")
  public ResponseEntity<CounselorSessionResponse> releaseSession(
      @PathVariable Long sessionId, Authentication authentication) {
    Long counselorId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(counselorService.releaseSession(sessionId, counselorId));
  }

  @GetMapping("/workspaces/{workspaceId}/consultation/sessions")
  public ResponseEntity<CounselorSessionResponse> getSessions(
      @PathVariable Long workspaceId,
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return ResponseEntity.ok(counselorService.getSessions(workspaceId, status, page, size));
  }
}
