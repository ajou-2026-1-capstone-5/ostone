import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { AdminCustomersPage } from "./AdminCustomersPage";

vi.mock("@/features/admin", () => ({
  AdminCustomerDashboard: () => <div data-testid="admin-customer-dashboard" />,
}));

describe("AdminCustomersPage", () => {
  it("고객사 현황 page heading과 dashboard를 표시한다", () => {
    render(<AdminCustomersPage />);

    expect(screen.getByRole("heading", { name: "고객사 현황" })).toBeInTheDocument();
    expect(screen.getByTestId("admin-customer-dashboard")).toBeInTheDocument();
  });
});
