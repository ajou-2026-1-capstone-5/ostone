import {
  login,
  logout,
  passwordResetComplete,
  passwordResetInit,
  refresh,
  signup,
} from '@/shared/api/generated/endpoints/auth-controller/auth-controller';
import type {
  LoginRequest,
  LoginResponse,
  PasswordResetCompleteRequest,
  PasswordResetInitResponse,
  SignupRequest,
  SignupResponse,
  TokenRefreshResponse,
} from '@/shared/api/generated/zod';

export type {
  LoginRequest,
  LoginResponse,
  PasswordResetCompleteRequest,
  SignupRequest,
  SignupResponse,
};

export async function loginApi(data: LoginRequest): Promise<LoginResponse> {
  return (await login(data)).data;
}

export async function signupApi(data: SignupRequest): Promise<SignupResponse> {
  return (await signup(data)).data;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  return (await logout({ refreshToken })).data;
}

export async function refreshTokenApi(refreshToken: string): Promise<TokenRefreshResponse> {
  return (await refresh({ refreshToken })).data;
}

export async function passwordResetInitApi(email: string): Promise<PasswordResetInitResponse> {
  return (await passwordResetInit({ email })).data;
}

export async function passwordResetCompleteApi(data: PasswordResetCompleteRequest): Promise<void> {
  return (await passwordResetComplete(data)).data;
}
