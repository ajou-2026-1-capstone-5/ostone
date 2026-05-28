package com.init.chatdemo.application.dto;

public class ListDemoChatMessagesCommand {

  private final Long workspaceId;
  private final Long sessionId;

  public ListDemoChatMessagesCommand(Long workspaceId, Long sessionId) {
    this.workspaceId = workspaceId;
    this.sessionId = sessionId;
  }

  public Long getWorkspaceId() {
    return workspaceId;
  }

  public Long getSessionId() {
    return sessionId;
  }
}
