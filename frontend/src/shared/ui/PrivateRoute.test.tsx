import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { AdminRoute, PrivateRoute } from "./PrivateRoute";

function createAccessToken(expSecondsFromNow: number, role = "OPERATOR"): string {
  const payload = {
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    role,
  };

  return `header.${btoa(JSON.stringify(payload))}.signature`;
}

function renderProtectedRoute(): void {
  render(
    <MemoryRouter initialEntries={["/private"]}>
      <Routes>
        <Route
          path="/private"
          element={
            <PrivateRoute>
              <div>보호 화면</div>
            </PrivateRoute>
          }
        />
        <Route path="/login" element={<div>로그인 화면</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("PrivateRoute", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("access token이 만료되어도 refresh token이 유효하면 보호 화면을 유지한다", async () => {
    localStorage.setItem("accessToken", createAccessToken(-60));
    localStorage.setItem("refreshToken", "valid-refresh-token");
    localStorage.setItem(
      "user",
      JSON.stringify({ id: 1, email: "admin@ostone.com", name: "관리자", role: "OWNER" }),
    );
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        accessToken: createAccessToken(3600),
        refreshToken: "new-refresh-token",
        tokenType: "Bearer",
        expiresIn: 3600,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderProtectedRoute();

    expect(await screen.findByText("보호 화면")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refreshToken: "valid-refresh-token" }),
      }),
    );
    expect(localStorage.getItem("refreshToken")).toBe("new-refresh-token");
    expect(localStorage.getItem("user")).toBe(
      JSON.stringify({ id: 1, email: "admin@ostone.com", name: "관리자", role: "OWNER" }),
    );
  });

  it("refresh token 갱신에 실패하면 session을 정리하고 login으로 이동한다", async () => {
    localStorage.setItem("accessToken", createAccessToken(-60));
    localStorage.setItem("refreshToken", "expired-refresh-token");
    localStorage.setItem("user", JSON.stringify({ id: 1 }));
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        code: "INVALID_TOKEN",
        message: "만료되거나 폐기된 리프레시 토큰입니다.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderProtectedRoute();

    expect(await screen.findByText("로그인 화면")).toBeInTheDocument();
    expect(localStorage.getItem("accessToken")).toBeNull();
    expect(localStorage.getItem("refreshToken")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });
});

function renderAdminRoute(role: string): void {
  localStorage.setItem("accessToken", createAccessToken(3600, role));
  localStorage.setItem(
    "user",
    JSON.stringify({ id: 1, email: "admin@ostone.com", name: "관리자", role }),
  );

  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <div>관리자 콘솔</div>
            </AdminRoute>
          }
        />
        <Route path="/workspaces" element={<div>워크스페이스</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AdminRoute", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("SUPER_ADMIN이면 관리자 콘솔을 렌더링한다", () => {
    renderAdminRoute("SUPER_ADMIN");

    expect(screen.getByText("관리자 콘솔")).toBeInTheDocument();
  });

  it("OPERATOR이면 워크스페이스로 이동한다", () => {
    renderAdminRoute("OPERATOR");

    expect(screen.getByText("워크스페이스")).toBeInTheDocument();
  });

  it("ADMIN이면 워크스페이스로 이동한다", () => {
    renderAdminRoute("ADMIN");

    expect(screen.getByText("워크스페이스")).toBeInTheDocument();
  });
});
