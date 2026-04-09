package com.init.workflowruntime.domain;

/** 상담 세션의 상태를 정의하는 열거형 클래스입니다. */
public enum ChatSessionStatus {
  /** 대기 중인 상태 */
  OPEN,

  /** 상담이 진행 중인 상태 */
  ACTIVE,

  /** 문제가 해결되어 종료 대기 중인 상태 */
  RESOLVED,

  /** 상담이 완전히 종료된 상태 */
  COMPLETED
}
