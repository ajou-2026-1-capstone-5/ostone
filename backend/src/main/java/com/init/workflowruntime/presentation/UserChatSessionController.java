package com.init.workflowruntime.presentation;

import com.init.shared.presentation.AuthenticationUtils;
import com.init.workflowruntime.application.UserChatSessionService;
import com.init.workflowruntime.application.command.GetOrCreateCurrentSessionCommand;
import com.init.workflowruntime.application.dto.ChatSessionResponse;
import com.init.workflowruntime.presentation.dto.CreateUserChatSessionRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/workspaces/{workspaceId}/chat/sessions")
public class UserChatSessionController {

  private final UserChatSessionService userChatSessionService;

  public UserChatSessionController(UserChatSessionService userChatSessionService) {
    this.userChatSessionService = userChatSessionService;
  }

  @GetMapping("/current")
  public ResponseEntity<ChatSessionResponse> getCurrentSession(
      @PathVariable Long workspaceId,
      @RequestParam String customerName,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        userChatSessionService.getOrCreateCurrentSession(
            new GetOrCreateCurrentSessionCommand(workspaceId, userId, customerName)));
  }

  @PostMapping
  public ResponseEntity<ChatSessionResponse> createSession(
      @PathVariable Long workspaceId,
      @Valid @RequestBody CreateUserChatSessionRequest request,
      Authentication authentication) {
    Long userId = AuthenticationUtils.getUserId(authentication);
    return ResponseEntity.ok(
        userChatSessionService.createSession(
            new GetOrCreateCurrentSessionCommand(workspaceId, userId, request.customerName())));
  }
}
