package com.init.workflowruntime.application.dto;

import com.init.workflowruntime.domain.ChatSession;
import java.time.OffsetDateTime;
import java.util.List;

public class CounselorSessionResponse {
  private Long id;
  private String status;
  private String channel;
  private String metaJson;
  private OffsetDateTime startedAt;
  private Long assignedCounselorId;
  private String responseMode;

  private List<ChatSessionResponse> content;
  private int page;
  private int size;
  private long totalElements;
  private int totalPages;

  public CounselorSessionResponse() {}

  public CounselorSessionResponse(
      List<ChatSessionResponse> content, int page, int size, long totalElements, int totalPages) {
    this.content = content;
    this.page = page;
    this.size = size;
    this.totalElements = totalElements;
    this.totalPages = totalPages;
  }

  public static CounselorSessionResponse from(ChatSession session) {
    CounselorSessionResponse resp = new CounselorSessionResponse();
    resp.id = session.getId();
    resp.status = session.getStatus() != null ? session.getStatus().name() : null;
    resp.channel = session.getChannel();
    resp.metaJson = session.getMetaJson();
    resp.startedAt = session.getStartedAt();
    resp.assignedCounselorId = session.getAssignedCounselorId();
    resp.responseMode = session.getResponseMode().name();
    return resp;
  }

  public Long getId() {
    return id;
  }

  public void setId(Long id) {
    this.id = id;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getChannel() {
    return channel;
  }

  public void setChannel(String channel) {
    this.channel = channel;
  }

  public String getMetaJson() {
    return metaJson;
  }

  public void setMetaJson(String metaJson) {
    this.metaJson = metaJson;
  }

  public OffsetDateTime getStartedAt() {
    return startedAt;
  }

  public void setStartedAt(OffsetDateTime startedAt) {
    this.startedAt = startedAt;
  }

  public Long getAssignedCounselorId() {
    return assignedCounselorId;
  }

  public void setAssignedCounselorId(Long assignedCounselorId) {
    this.assignedCounselorId = assignedCounselorId;
  }

  public String getResponseMode() {
    return responseMode;
  }

  public void setResponseMode(String responseMode) {
    this.responseMode = responseMode;
  }

  public List<ChatSessionResponse> getContent() {
    return content;
  }

  public void setContent(List<ChatSessionResponse> content) {
    this.content = content;
  }

  public int getPage() {
    return page;
  }

  public void setPage(int page) {
    this.page = page;
  }

  public int getSize() {
    return size;
  }

  public void setSize(int size) {
    this.size = size;
  }

  public long getTotalElements() {
    return totalElements;
  }

  public void setTotalElements(long totalElements) {
    this.totalElements = totalElements;
  }

  public int getTotalPages() {
    return totalPages;
  }

  public void setTotalPages(int totalPages) {
    this.totalPages = totalPages;
  }
}
