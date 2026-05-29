package com.init.workflowruntime.presentation;

import com.init.workflowruntime.application.ConsultationService;
import com.init.workflowruntime.application.LlmToolService;
import com.init.workflowruntime.application.command.GetCurrentWorkflowCommand;
import com.init.workflowruntime.application.dto.ChatMessageResponse;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.application.dto.LlmToolWorkflowResponse;
import com.init.workflowruntime.application.dto.SendMessageRequest;
import com.init.workflowruntime.application.dto.UpdateStatusRequest;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** 상담 운영자 대화 및 세션을 관리하는 REST 컨트롤러입니다. 상담 대기열 조회, 메시지 송수신, 세션 상태 변경 등의 기능을 제공합니다. */
@RestController
@RequestMapping("/api/v1/consultation")
public class ConsultationController {

  private final ConsultationService consultationService;
  private final LlmToolService llmToolService;

  /**
   * ConsultationController 생성자입니다.
   *
   * @param consultationService 상담 비즈니스 로직 서비스
   * @param llmToolService 매칭된 워크플로우 조회를 위한 LLM tool 서비스
   */
  public ConsultationController(
      ConsultationService consultationService, LlmToolService llmToolService) {
    this.consultationService = consultationService;
    this.llmToolService = llmToolService;
  }

  /**
   * 특정 상담 세션의 전체 메시지 이력을 조회합니다.
   *
   * @param sessionId 조회할 세션 ID
   * @return 메시지 상세 목록 응답
   */
  @GetMapping("/sessions/{sessionId}/messages")
  public ResponseEntity<List<ChatMessageResponse>> getMessages(@PathVariable Long sessionId) {
    return ResponseEntity.ok(consultationService.getMessages(sessionId));
  }

  /**
   * 상담사가 특정 세션에 메시지를 전송합니다.
   *
   * @param sessionId 메시지를 보낼 세션 ID
   * @param request 메시지 내용(텍스트, 노트 여부 등)을 담은 객체
   * @return 생성된 메시지 상세 응답
   */
  @PostMapping("/sessions/{sessionId}/messages")
  public ResponseEntity<ChatMessageResponse> sendMessage(
      @PathVariable Long sessionId, @Valid @RequestBody SendMessageRequest request) {
    return ResponseEntity.ok(consultationService.sendMessage(sessionId, request));
  }

  /**
   * 상담 세션의 상태(ACTIVE, RESOLVED 등)를 업데이트합니다.
   *
   * @param sessionId 상태를 변경할 세션 ID
   * @param request 변경할 상태 정보를 담은 객체
   * @return 업데이트된 세션 상세 응답
   */
  @PatchMapping("/sessions/{sessionId}/status")
  public ResponseEntity<ChatSessionResponse> updateStatus(
      @PathVariable Long sessionId, @Valid @RequestBody UpdateStatusRequest request) {
    return ResponseEntity.ok(
        consultationService.updateSessionStatus(sessionId, request.getStatus()));
  }

  /**
   * 상담 세션에 현재 매칭된 워크플로우 메타데이터와 그래프를 조회합니다.
   *
   * <p>운영자 화면 우측 패널의 매칭 워크플로우 바를 그리기 위한 thin endpoint입니다.
   *
   * @param sessionId 매칭 워크플로우를 조회할 세션 ID
   * @return 워크플로우 정의/실행 상태를 담은 응답
   */
  @GetMapping("/sessions/{sessionId}/matched-workflow")
  public ResponseEntity<LlmToolWorkflowResponse> getMatchedWorkflow(@PathVariable Long sessionId) {
    return ResponseEntity.ok(
        llmToolService.getCurrentWorkflow(new GetCurrentWorkflowCommand(sessionId)));
  }
}
