import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import {
  loginApi,
  signupApi,
  passwordResetInitApi,
  logoutApi,
  refreshTokenApi,
  passwordResetCompleteApi,
} from "./authApi";
import {
  login,
  signup,
  logout,
  passwordResetInit,
  refresh,
  passwordResetComplete,
} from "@/shared/api/generated/endpoints/auth-controller/auth-controller";

vi.mock("@/shared/api/generated/endpoints/auth-controller/auth-controller", () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  passwordResetInit: vi.fn(),
  refresh: vi.fn(),
  passwordResetComplete: vi.fn(),
}));

const mockedLogin = vi.mocked(login);
const mockedSignup = vi.mocked(signup);
const mockedLogout = vi.mocked(logout);
const mockedPasswordResetInit = vi.mocked(passwordResetInit);
const mockedRefresh = vi.mocked(refresh);
const mockedPasswordResetComplete = vi.mocked(passwordResetComplete);

describe("Auth API Integration Tests", () => {
  let originalGetItem: typeof Storage.prototype.getItem;

  beforeEach(() => {
    mockedLogin.mockClear();
    mockedSignup.mockClear();
    mockedLogout.mockClear();
    mockedPasswordResetInit.mockClear();
    mockedRefresh.mockClear();
    mockedPasswordResetComplete.mockClear();
    originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => "mock-token");
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
  });

  it("loginApi 메서드가 올바른 데이터와 함께 login()을 호출하는지 확인한다", async () => {
    const mockResponse = {
      accessToken: "dummy-access",
      tokenType: "Bearer",
      expiresIn: 1800000,
      user: { id: 1, email: "test@test.com", name: "Tester", role: "OPERATOR" },
    };

    mockedLogin.mockResolvedValueOnce({
      data: mockResponse,
      status: 200,
      headers: new Headers(),
    });

    const result = await loginApi({ email: "test@test.com", password: "password123" });

    expect(mockedLogin).toHaveBeenCalledWith(
      { email: "test@test.com", password: "password123" },
      { credentials: "include" },
    );
    expect(result.accessToken).toEqual("dummy-access");
    expect(result.user?.name).toEqual("Tester");
  });

  it("signupApi 메서드가 signup()을 호출하는지 확인한다", async () => {
    mockedSignup.mockResolvedValueOnce({
      data: { id: 2, email: "new@test.com", name: "NewUser" },
      status: 200,
      headers: new Headers(),
    });

    const result = await signupApi({ email: "new@test.com", name: "NewUser", password: "pwd" });

    expect(mockedSignup).toHaveBeenCalledWith({
      email: "new@test.com",
      name: "NewUser",
      password: "pwd",
    });
    expect(result.email).toEqual("new@test.com");
  });

  it("로그아웃 시 cookie 포함 옵션으로 logout()을 호출하는지 확인한다", async () => {
    mockedLogout.mockResolvedValueOnce({
      data: undefined,
      status: 200,
      headers: new Headers(),
    });

    await logoutApi();

    expect(mockedLogout).toHaveBeenCalledWith({ credentials: "include" });
  });

  it("passwordResetInitApi 요청 시 에러 응답을 올바르게 던지는지 확인한다", async () => {
    mockedPasswordResetInit.mockRejectedValueOnce(new Error("가입되지 않은 이메일입니다."));

    await expect(passwordResetInitApi("wrong@test.com")).rejects.toThrow(
      "가입되지 않은 이메일입니다.",
    );
  });

  it("refreshTokenApi가 cookie 포함 옵션으로 refresh()를 호출한다", async () => {
    const mockResponse = {
      accessToken: "new-access",
      tokenType: "Bearer",
      expiresIn: 1800000,
    };
    mockedRefresh.mockResolvedValueOnce({
      data: mockResponse,
      status: 200,
      headers: new Headers(),
    });

    const result = await refreshTokenApi();

    expect(mockedRefresh).toHaveBeenCalledWith({ credentials: "include" });
    expect(result.accessToken).toBe("new-access");
  });

  it("passwordResetCompleteApi가 데이터와 함께 passwordResetComplete()를 호출한다", async () => {
    mockedPasswordResetComplete.mockResolvedValueOnce({
      data: undefined,
      status: 200,
      headers: new Headers(),
    });

    await passwordResetCompleteApi({ token: "reset-token", newPassword: "newpwd123" });

    expect(mockedPasswordResetComplete).toHaveBeenCalledWith({
      token: "reset-token",
      newPassword: "newpwd123",
    });
  });
});
