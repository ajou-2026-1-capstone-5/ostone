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
  return login(data) as unknown as Promise<LoginResponse>;
}

export async function signupApi(data: SignupRequest): Promise<SignupResponse> {
  return signup(data) as unknown as Promise<SignupResponse>;
}

export async function logoutApi(refreshToken: string): Promise<void> {
  await logout({ refreshToken });
}

export async function refreshTokenApi(refreshToken: string): Promise<TokenRefreshResponse> {
  return refresh({ refreshToken }) as unknown as Promise<TokenRefreshResponse>;
}

export async function passwordResetInitApi(email: string): Promise<PasswordResetInitResponse> {
  return passwordResetInit({ email }) as unknown as Promise<PasswordResetInitResponse>;
}

export async function passwordResetCompleteApi(data: PasswordResetCompleteRequest): Promise<void> {
  await passwordResetComplete(data);
}
