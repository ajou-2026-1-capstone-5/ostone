import {
  login,
  logout,
  passwordResetComplete,
  passwordResetInit,
  refresh,
  signup,
} from "@/shared/api/generated/endpoints/auth-controller/auth-controller";
import type {
  LoginRequest,
  LoginResponse,
  PasswordResetCompleteRequest,
  PasswordResetInitResponse,
  SignupRequest,
  SignupResponse,
  TokenRefreshResponse,
} from "@/shared/api/generated/zod";
import { requireApiData } from "@/shared/api";

export type {
  LoginRequest,
  LoginResponse,
  PasswordResetCompleteRequest,
  SignupRequest,
  SignupResponse,
};

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  const response = await login(data);
  return requireApiData<LoginResponse>(response, "로그인 응답을 확인할 수 없습니다.");
}

export async function signupApi(data: SignupRequest): Promise<SignupResponse> {
  const response = await signup(data);
  return requireApiData<SignupResponse>(response, "회원가입 응답을 확인할 수 없습니다.");
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await logout({ refreshToken });
}

export async function refreshTokenApi(refreshToken: string): Promise<TokenRefreshResponse> {
  const response = await refresh({ refreshToken });
  return requireApiData<TokenRefreshResponse>(response, "토큰 갱신 응답을 확인할 수 없습니다.");
}

export async function passwordResetInitApi(email: string): Promise<PasswordResetInitResponse> {
  const response = await passwordResetInit({ email });
  return requireApiData<PasswordResetInitResponse>(
    response,
    "비밀번호 재설정 응답을 확인할 수 없습니다.",
  );
}

export async function passwordResetCompleteApi(data: PasswordResetCompleteRequest): Promise<void> {
  await passwordResetComplete(data);
}
