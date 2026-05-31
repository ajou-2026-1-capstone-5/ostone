import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { IntentRevisionChange } from "../model/useIntentRevisionSummary";
import { IntentRevisionDiffPanel } from "./IntentRevisionDiffPanel";

const change: IntentRevisionChange = {
  intentId: 10,
  intentCode: "refund",
  name: "환불 문의",
  fields: ["name", "description"],
  before: { name: "환불", description: "" },
  after: { name: "환불 문의", description: "새 설명" },
};

describe("IntentRevisionDiffPanel", () => {
  it("변경된 필드의 before/after 값을 보여준다", () => {
    render(<IntentRevisionDiffPanel change={change} />);

    expect(screen.getByLabelText("상담 유형 수정 내용")).toBeInTheDocument();
    expect(screen.getByText("2개 항목")).toBeInTheDocument();
    expect(screen.getByText("환불")).toBeInTheDocument();
    expect(screen.getByText("환불 문의")).toBeInTheDocument();
    expect(screen.getByText("비어 있음")).toBeInTheDocument();
    expect(screen.getByText("새 설명")).toBeInTheDocument();
  });

  it("변경 정보가 없으면 렌더링하지 않는다", () => {
    const { container } = render(<IntentRevisionDiffPanel />);

    expect(container).toBeEmptyDOMElement();
  });
});
