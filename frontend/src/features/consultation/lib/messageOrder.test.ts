import { describe, expect, it } from "vitest";
import { compareByServerOrder, sortMessagesByServerOrder } from "./messageOrder";

type TestMessage = {
  id: string;
  seqNo?: number;
  createdAt?: string;
};

const ids = (messages: TestMessage[]) => messages.map((message) => message.id);

describe("sortMessagesByServerOrder", () => {
  it("orders messages by server seqNo regardless of input order", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "c", seqNo: 3 },
      { id: "a", seqNo: 1 },
      { id: "b", seqNo: 2 },
    ]);

    expect(ids(sorted)).toEqual(["a", "b", "c"]);
  });

  it("falls back to createdAt when seqNo is missing and events arrive out of order", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "bot", createdAt: "2026-05-27T00:00:03+09:00" },
      { id: "user", createdAt: "2026-05-27T00:00:02+09:00" },
    ]);

    expect(ids(sorted)).toEqual(["user", "bot"]);
  });

  it("places seqNo-confirmed messages before optimistic messages without seqNo", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "optimistic" },
      { id: "server", seqNo: 10, createdAt: "2026-05-27T00:00:01+09:00" },
    ]);

    expect(ids(sorted)).toEqual(["server", "optimistic"]);
  });

  it("keeps original order for messages that share the same seqNo", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "first", seqNo: 5 },
      { id: "second", seqNo: 5 },
    ]);

    expect(ids(sorted)).toEqual(["first", "second"]);
  });

  it("keeps original order for optimistic messages without seqNo or createdAt", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "sending-1" },
      { id: "sending-2" },
      { id: "sending-3" },
    ]);

    expect(ids(sorted)).toEqual(["sending-1", "sending-2", "sending-3"]);
  });

  it("uses createdAt as a tie-breaker when seqNo is equal", () => {
    const sorted = sortMessagesByServerOrder<TestMessage>([
      { id: "later", seqNo: 7, createdAt: "2026-05-27T00:00:05+09:00" },
      { id: "earlier", seqNo: 7, createdAt: "2026-05-27T00:00:01+09:00" },
    ]);

    expect(ids(sorted)).toEqual(["earlier", "later"]);
  });
});

describe("compareByServerOrder", () => {
  it("returns 0 when neither seqNo nor createdAt distinguishes the messages", () => {
    expect(compareByServerOrder({}, {})).toBe(0);
  });

  it("falls back to original order when createdAt is unparseable", () => {
    expect(compareByServerOrder({ createdAt: "not-a-date" }, { createdAt: "also-bad" })).toBe(0);
  });
});
