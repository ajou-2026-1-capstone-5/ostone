import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useIntentDetail } from "../model/useIntentDetail";
import { IntentDetailPanel } from "./IntentDetailPanel";

vi.mock("../model/useIntentDetail", () => ({
  useIntentDetail: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const mockedUseIntentDetail = vi.mocked(useIntentDetail);

const stubDetail = {
  id: 10,
  intentCode: "INTENT_001",
  name: "배송 조회 문의",
  description: null,
  taxonomyLevel: 1,
  parentIntentId: null,
  status: "ACTIVE",
  sourceClusterRef: "{}",
  entryConditionJson: "{}",
  evidenceJson: "[]",
  metaJson: "{}",
  createdAt: "",
  updatedAt: "",
};

function renderPanel(props: Partial<React.ComponentProps<typeof IntentDetailPanel>> = {}) {
  const defaults = {
    wsId: 1,
    packId: 2,
    versionId: 3,
    intentId: 10 as number | null,
  };
  render(<IntentDetailPanel {...defaults} {...props} />);
}

describe("IntentDetailPanel", () => {
  beforeEach(() => {
    mockedUseIntentDetail.mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("idle 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "idle" });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ intentId: null, children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("loading 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "loading" });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("error 상태에서는 children render-prop을 호출하지 않는다", () => {
    mockedUseIntentDetail.mockReturnValue({
      status: "error",
      code: "NOT_FOUND",
      message: "없음",
      httpStatus: 404,
    });
    const childrenFn = vi.fn(() => <div data-testid="children">children</div>);

    renderPanel({ children: childrenFn });

    expect(childrenFn).not.toHaveBeenCalled();
    expect(screen.queryByTestId("children")).not.toBeInTheDocument();
  });

  it("ready 상태에서 children이 없으면 기존 렌더링을 유지한다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "ready", data: stubDetail });

    renderPanel();

    expect(screen.getByText("INTENT_001")).toBeInTheDocument();
    expect(screen.getByText("배송 조회 문의")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("ready 상태에서 children render-prop을 호출하고 detail.data를 전달한다", () => {
    mockedUseIntentDetail.mockReturnValue({ status: "ready", data: stubDetail });
    const childrenFn = vi.fn((detail) => (
      <div data-testid="children">{detail.name}</div>
    ));

    renderPanel({ children: childrenFn });

    expect(childrenFn).toHaveBeenCalledTimes(1);
    expect(childrenFn).toHaveBeenCalledWith(stubDetail);
    expect(screen.getByTestId("children")).toHaveTextContent("배송 조회 문의");
    expect(screen.getByText("INTENT_001")).toBeInTheDocument();
  });
});
