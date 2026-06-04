import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EnterpriseContactDialog } from "./EnterpriseContactDialog";

describe("EnterpriseContactDialog", () => {
  it("기본 트리거 라벨 '도입 문의'를 렌더링한다", () => {
    render(<EnterpriseContactDialog />);
    expect(screen.getByRole("button", { name: "도입 문의" })).toBeTruthy();
  });

  it("트리거 클릭 시 다이얼로그에 연락처를 표시한다", async () => {
    render(<EnterpriseContactDialog />);
    expect(screen.queryByText("02-XXX-XXXX")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "도입 문의" }));

    expect(await screen.findByText("02-XXX-XXXX")).toBeTruthy();
    expect(screen.getByText("Enterprise 도입 문의")).toBeTruthy();
  });

  it("커스텀 트리거 라벨을 지원한다", () => {
    render(<EnterpriseContactDialog triggerLabel="영업팀 문의" />);
    expect(screen.getByRole("button", { name: "영업팀 문의" })).toBeTruthy();
  });
});
