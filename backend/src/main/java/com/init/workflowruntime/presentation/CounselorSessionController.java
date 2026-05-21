package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.CounselorService;
import com.init.workflowruntime.application.dto.CounselorSessionResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/consultation")
public class CounselorSessionController {

  private final CounselorService counselorService;

  public CounselorSessionController(CounselorService counselorService) {
    this.counselorService = counselorService;
  }

  @PostMapping("/sessions/{sessionId}/assign")
  public ResponseEntity<CounselorSessionResponse> assignSession(
      @PathVariable Long sessionId, @RequestParam Long counselorId) {
    return ResponseEntity.ok(counselorService.assignSession(counselorId, sessionId));
  }

  @PostMapping("/sessions/{sessionId}/release")
  public ResponseEntity<CounselorSessionResponse> releaseSession(
      @PathVariable Long sessionId, @RequestParam Long counselorId) {
    return ResponseEntity.ok(counselorService.releaseSession(sessionId, counselorId));
  }

  @GetMapping("/sessions")
  public ResponseEntity<CounselorSessionResponse> getSessions(
      @RequestParam(required = false) String status,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return ResponseEntity.ok(counselorService.getSessions(status, page, size));
  }
}
