import { apiClient } from '../../../shared/api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  user: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface SignupResponse {
  id: number;
  email: string;
  name: string;
}

export function loginApi(data: LoginRequest): Promise<LoginResponse> {
  return apiClient.post<LoginResponse>('/auth/login', data);
}

export function signupApi(data: SignupRequest): Promise<SignupResponse> {
  return apiClient.post<SignupResponse>('/auth/signup', data);
}

export function logoutApi(refreshToken: string): Promise<void> {
  return apiClient.post<void>('/auth/logout', { refreshToken });
}

export function refreshTokenApi(refreshToken: string) {
  return apiClient.post<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  }>('/auth/refresh', { refreshToken });
}

export function passwordResetInitApi(email: string): Promise<{ message: string }> {
  return apiClient.post<{ message: string }>('/auth/password-reset/init', { email });
}

export interface PasswordResetCompleteRequest {
  resetToken: string;
  newPassword: string;
}

export function passwordResetCompleteApi(data: PasswordResetCompleteRequest): Promise<void> {
  return apiClient.post<void>('/auth/password-reset/complete', data);
}
