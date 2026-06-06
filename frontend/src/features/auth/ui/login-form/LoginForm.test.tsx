import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { loginApi } from "../../api/authApi";
import { listWorkspaces } from "@/shared/api/generated/endpoints/workspace-controller/workspace-controller";
import type { WorkspaceResponse } from "@/shared/api/generated/zod";
import { LoginForm } from "./LoginForm";

vi.mock("../../api/authApi", () => ({
  loginApi: vi.fn(),
}));

vi.mock("@/shared/api/generated/endpoints/workspace-controller/workspace-controller", () => ({
  listWorkspaces: vi.fn(),
}));

const mockedLoginApi = vi.mocked(loginApi);
const mockedListWorkspaces = vi.mocked(listWorkspaces);

function listResponse(data: WorkspaceResponse[]): Awaited<ReturnType<typeof listWorkspaces>> {
  return {
    data,
    status: 200,
    headers: new Headers(),
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderLoginForm(state?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
      <Routes>
        <Route
          path="/login"
          element={
            <>
              <LoginForm />
              <LocationProbe />
            </>
          }
        />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function submitLoginForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("이메일 주소"), "admin@ostone.com");
  await user.type(screen.getByLabelText("비밀번호"), "password123");
  await user.click(screen.getByRole("button", { name: "시스템 로그인" }));
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockedLoginApi.mockReset();
    mockedListWorkspaces.mockReset();
    localStorage.clear();
    mockedLoginApi.mockResolvedValue({
      accessToken: "access-token",
      tokenType: "Bearer",
      expiresIn: 1800,
      user: { id: 1, email: "admin@ostone.com", name: "Admin", role: "OWNER" },
    });
  });

  it("return-to가 없으면 기본 워크스페이스 workflows 화면으로 바로 이동한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([
        { id: 1, name: "Archived", status: "ARCHIVED" },
        { id: 7, name: "Active", status: "ACTIVE" },
      ]),
    );

    renderLoginForm();
    localStorage.setItem("refreshToken", "legacy-refresh-token");
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/7/workflows");
    });
    expect(mockedListWorkspaces).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("refreshToken")).toBeNull();
  });

  it("현재 계정 workspace return-to 경로가 있으면 해당 경로를 우선한다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(
      listResponse([{ id: 4, name: "Current", status: "ACTIVE" }]),
    );

    renderLoginForm({
      from: { pathname: "/workspaces/4/upload", search: "?tab=logs" },
    });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces/4/upload?tab=logs");
    });
    expect(mockedListWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("workspace가 없는 신규 사용자의 stale workspace return-to는 /workspaces로 보낸다", async () => {
    mockedListWorkspaces.mockResolvedValueOnce(listResponse([]));

    renderLoginForm({
      from: { pathname: "/workspaces/4/upload" },
    });
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces");
    });
    expect(mockedListWorkspaces).toHaveBeenCalledTimes(1);
  });

  it("기본 워크스페이스를 확인할 수 없으면 /workspaces fallback으로 이동한다", async () => {
    mockedListWorkspaces.mockRejectedValueOnce(new Error("network error"));

    renderLoginForm();
    await submitLoginForm();

    await waitFor(() => {
      expect(screen.getByTestId("location")).toHaveTextContent("/workspaces");
    });
  });
});
