import { describe, expect, it } from "vitest";
import {
  DEFAULT_NODE_STATUS,
  NODE_STATUSES,
  NODE_STATUS_STYLE_MAP,
  NODE_TYPES,
} from "./nodeStatus";
import type { GraphNodeStatus } from "./nodeStatus";

describe("nodeStatus", () => {
  it("NODE_TYPES는 6개 타입을 모두 포함한다", () => {
    expect(NODE_TYPES).toEqual(["START", "ACTION", "DECISION", "ANSWER", "HANDOFF", "TERMINAL"]);
  });

  it("NODE_STATUSES는 4개 상태를 모두 포함한다", () => {
    expect(NODE_STATUSES).toEqual(["IDLE", "ACTIVE", "COMPLETED", "FAILED"]);
  });

  it("DEFAULT_NODE_STATUS는 IDLE이다", () => {
    expect(DEFAULT_NODE_STATUS).toBe("IDLE");
  });

  it("NODE_STATUS_STYLE_MAP은 모든 상태에 className과 label을 가진다", () => {
    const keys = Object.keys(NODE_STATUS_STYLE_MAP) as GraphNodeStatus[];
    expect(keys).toHaveLength(4);
    expect(keys).toEqual(["IDLE", "ACTIVE", "COMPLETED", "FAILED"]);

    expect(NODE_STATUS_STYLE_MAP.IDLE).toEqual({
      className: "statusIdle",
      label: "대기",
    });
    expect(NODE_STATUS_STYLE_MAP.ACTIVE).toEqual({
      className: "statusActive",
      label: "실행 중",
    });
    expect(NODE_STATUS_STYLE_MAP.COMPLETED).toEqual({
      className: "statusCompleted",
      label: "완료",
    });
    expect(NODE_STATUS_STYLE_MAP.FAILED).toEqual({
      className: "statusFailed",
      label: "실패",
    });
  });

  it("GraphNodeStatus 타입은 IDLE | ACTIVE | COMPLETED | FAILED로 한정된다", () => {
    const accept: GraphNodeStatus = "IDLE";
    expect(accept).toBe("IDLE");
  });
});
