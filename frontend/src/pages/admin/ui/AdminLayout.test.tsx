import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { AdminLayout } from "./AdminLayout";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
}));

vi.mock("@/features/auth/model/useLogout", () => ({
  useLogout: () => ({ logout: mocks.logout }),
}));

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/admin/super-admins"]}>
      <AdminLayout />
    </MemoryRouter>,
  );
}

describe("AdminLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("사이드바에 로그아웃 버튼을 노출한다", () => {
    renderLayout();
    expect(screen.getByTestId("admin-logout")).toBeInTheDocument();
  });

  it("로그아웃 버튼을 누르면 useLogout 의 logout 을 호출한다", async () => {
    renderLayout();
    await userEvent.click(screen.getByTestId("admin-logout"));
    expect(mocks.logout).toHaveBeenCalledTimes(1);
  });
});
