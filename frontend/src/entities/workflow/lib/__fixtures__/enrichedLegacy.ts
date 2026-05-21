import type { WorkflowGraph } from "../../model/types";

/**
 * Legacy account-recovery workflow (start → identity verified? →
 * unlock + confirm → done / no → security_team → done) re-defined with
 * every optional field this session introduced.
 *
 * Positions are chosen with generous horizontal/vertical gaps so cards
 * never overlap and bezier edges have room to curve naturally.
 */
export const enrichedLegacyGraph: WorkflowGraph = {
  direction: "LR",
  nodes: [
    {
      id: "start",
      type: "START",
      label: "start",
      description: "계정 잠금 해제 상담이 인입되었을 때 워크플로우가 시작됩니다.",
      iconHint: "Inbox",
      badges: ["트리거", "1회"],
      accentColor: "violet",
      meta: { channel: "web", trigger: "ticket.opened" },
      status: "COMPLETED",
      position: { x: 0, y: 240 },
    },
    {
      id: "identity_verified",
      type: "DECISION",
      label: "identity verified?",
      description: "본인 확인 여부에 따라 자동 unlock 경로와 보안팀 인계 경로로 분기합니다.",
      iconHint: "GitBranch",
      badges: ["2-way", "field:identity.verified"],
      accentColor: "amber",
      meta: { field: "identity.verified", branches: "2" },
      status: "ACTIVE",
      position: { x: 360, y: 240 },
    },
    {
      id: "unlock",
      type: "ACTION",
      label: "unlock",
      description: "계정 자동 잠금 해제 정책을 적용하고 활동 로그를 기록합니다.",
      policyRef: "ACT-UNLOCK-001",
      iconHint: "Zap",
      badges: ["policy:unlock", "audit:on"],
      accentColor: "indigo",
      meta: { policy: "auto_unlock", audit: "on" },
      status: "IDLE",
      position: { x: 760, y: 60 },
    },
    {
      id: "security_team",
      type: "HANDOFF",
      label: "security_team",
      description: "본인 확인 실패 → 보안팀 큐로 인계 (SLA 15분, 우선순위 높음).",
      iconHint: "UserPlus",
      badges: ["팀: 보안", "sla:15m"],
      accentColor: "rose",
      meta: { queue: "security-l2", sla: "15m" },
      status: "IDLE",
      position: { x: 760, y: 420 },
    },
    {
      id: "confirm",
      type: "ANSWER",
      label: "confirm",
      description: "잠금 해제 결과를 사용자에게 안내하고 후속 안내 카드를 전송합니다.",
      iconHint: "MessageSquare",
      badges: ["template:confirm"],
      accentColor: "sky",
      meta: { template: "unlock_confirmed", buttons: "1" },
      status: "IDLE",
      position: { x: 1160, y: 60 },
    },
    {
      id: "done",
      type: "TERMINAL",
      label: "done",
      description: "resolved",
      iconHint: "CircleCheck",
      accentColor: "zinc",
      meta: { outcome: "resolved" },
      status: "IDLE",
      position: { x: 1560, y: 240 },
    },
  ],
  edges: [
    { id: "e1", from: "start", to: "identity_verified" },
    {
      id: "e2",
      from: "identity_verified",
      to: "unlock",
      label: "yes",
      sourceHandle: "top",
      targetHandle: "left",
    },
    {
      id: "e3",
      from: "identity_verified",
      to: "security_team",
      label: "no",
      sourceHandle: "bottom",
      targetHandle: "left",
    },
    { id: "e4", from: "unlock", to: "confirm" },
    {
      id: "e5",
      from: "confirm",
      to: "done",
      sourceHandle: "right",
      targetHandle: "top",
    },
    {
      id: "e6",
      from: "security_team",
      to: "done",
      sourceHandle: "right",
      targetHandle: "bottom",
    },
  ],
};
