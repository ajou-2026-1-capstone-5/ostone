import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QuotaUsageCard } from "./QuotaUsageCard";

describe("QuotaUsageCard", () => {
  it("quota 사용량과 warning 상태를 렌더링한다", () => {
    render(
      <QuotaUsageCard
        quotaUsages={[
          { resource: "MEMBER", used: 3, limit: 10, warning: false },
          { resource: "DATASET_UPLOAD", used: 10, limit: 10, warning: true },
        ]}
      />,
    );

    expect(screen.getByLabelText("Quota 사용량")).toBeTruthy();
    expect(screen.getByText("멤버")).toBeTruthy();
    expect(screen.getByText("3 / 10")).toBeTruthy();
    expect(screen.getByText("Dataset 업로드")).toBeTruthy();
    expect(screen.getByText("10 / 10")).toBeTruthy();
    expect(screen.getByText("한도에 도달했습니다.")).toBeTruthy();
  });

  it("알 수 없는 resource와 0 limit은 안전한 기본값으로 표시한다", () => {
    const { container } = render(
      <QuotaUsageCard
        quotaUsages={[
          { resource: undefined, used: undefined, limit: undefined, warning: false },
          { resource: "CUSTOM", used: 1, limit: 0, warning: false },
        ]}
      />,
    );

    expect(screen.getAllByText("Quota")).toHaveLength(2);
    expect(screen.getByText("CUSTOM")).toBeTruthy();
    expect(screen.getByText("0 / 0")).toBeTruthy();
    expect(screen.getByText("1 / 0")).toBeTruthy();
    expect(container.querySelectorAll('[style="width: 0%;"]')).toHaveLength(2);
  });
});
