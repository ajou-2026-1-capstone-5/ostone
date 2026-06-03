import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SubscriptionStatusCard } from "./SubscriptionStatusCard";
import type { SubscriptionResponse } from "../model/types";

const stubSubscription: SubscriptionResponse = {
  id: 1,
  workspaceId: 1,
  planKey: "PRO",
  status: "ACTIVE",
  customerKey: "ws_1",
  cancelAtPeriodEnd: false,
  currentPeriodStart: "2024-01-01T00:00:00Z",
  currentPeriodEnd: "2024-02-01T00:00:00Z",
  createdAt: "2024-01-01T00:00:00Z",
};

describe("SubscriptionStatusCard", () => {
  it("구독 상태를 렌더링한다", () => {
    render(<SubscriptionStatusCard subscription={stubSubscription} />);
    expect(screen.getByText("구독")).toBeTruthy();
    expect(screen.getByText("구독 중")).toBeTruthy();
  });

  it("cancelAtPeriodEnd가 true이면 해지 예약 표시", () => {
    const cancelSub = { ...stubSubscription, cancelAtPeriodEnd: true };
    render(<SubscriptionStatusCard subscription={cancelSub} />);
    expect(screen.getByText(/해지 예약/)).toBeTruthy();
  });

  it("PRO 플랜 이름 표시", () => {
    render(<SubscriptionStatusCard subscription={stubSubscription} />);
    expect(screen.getByText(/Pro/i)).toBeTruthy();
  });
});
