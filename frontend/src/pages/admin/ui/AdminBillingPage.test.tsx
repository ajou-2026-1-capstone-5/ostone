import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { AdminBillingPage } from "./AdminBillingPage";

vi.mock("@/features/admin-billing", () => ({
  AdminBillingManagement: () => <div>관리 위젯</div>,
}));

describe("AdminBillingPage", () => {
  it("결제 관리 페이지 제목과 위젯을 표시한다", () => {
    render(<AdminBillingPage />);

    expect(screen.getByRole("heading", { name: "결제 관리" })).toBeInTheDocument();
    expect(screen.getByText("관리 위젯")).toBeInTheDocument();
  });
});
