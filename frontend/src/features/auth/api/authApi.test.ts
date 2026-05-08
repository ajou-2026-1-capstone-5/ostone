import { describe, it, expect, vi, beforeEach, afterEach } from 'vite-plus/test';
import { loginApi, signupApi, passwordResetInitApi, logoutApi } from './authApi';
import { login, signup, logout, passwordResetInit } from '@/shared/api/generated/endpoints/auth-controller/auth-controller';

vi.mock('@/shared/api/generated/endpoints/auth-controller/auth-controller', () => ({
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
  passwordResetInit: vi.fn(),
}));

const mockedLogin = vi.mocked(login);
const mockedSignup = vi.mocked(signup);
const mockedLogout = vi.mocked(logout);
const mockedPasswordResetInit = vi.mocked(passwordResetInit);

describe('Auth API Integration Tests', () => {
  let originalGetItem: typeof Storage.prototype.getItem;

  beforeEach(() => {
    mockedLogin.mockClear();
    mockedSignup.mockClear();
    mockedLogout.mockClear();
    mockedPasswordResetInit.mockClear();
    originalGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = vi.fn(() => 'mock-token');
  });

  afterEach(() => {
    Storage.prototype.getItem = originalGetItem;
  });

  it('loginApi 메서드가 올바른 데이터와 함께 login()을 호출하는지 확인한다', async () => {
    const mockResponse = {
      accessToken: 'dummy-access',
      refreshToken: 'dummy-refresh',
      tokenType: 'Bearer',
      expiresIn: 1800000,
      user: { id: 1, email: 'test@test.com', name: 'Tester', role: 'OPERATOR' }
    };

    mockedLogin.mockResolvedValueOnce(mockResponse as any);

    const result = await loginApi({ email: 'test@test.com', password: 'password123' });

    expect(mockedLogin).toHaveBeenCalledWith({ email: 'test@test.com', password: 'password123' });
    expect(result.accessToken).toEqual('dummy-access');
    expect(result.user?.name).toEqual('Tester');
  });

  it('signupApi 메서드가 signup()을 호출하는지 확인한다', async () => {
    mockedSignup.mockResolvedValueOnce({ id: 2, email: 'new@test.com', name: 'NewUser' } as any);

    const result = await signupApi({ email: 'new@test.com', name: 'NewUser', password: 'pwd' });

    expect(mockedSignup).toHaveBeenCalledWith({ email: 'new@test.com', name: 'NewUser', password: 'pwd' });
    expect(result.email).toEqual('new@test.com');
  });

  it('로그아웃 시 리프레시 토큰을 포함하여 logout()을 호출하는지 확인한다', async () => {
 mockedLogout.mockResolvedValueOnce(undefined as any);

    await logoutApi('dummy-refresh');

    expect(mockedLogout).toHaveBeenCalledWith({ refreshToken: 'dummy-refresh' });
  });

  it('passwordResetInitApi 요청 시 에러 응답을 올바르게 던지는지 확인한다', async () => {
    mockedPasswordResetInit.mockRejectedValueOnce(new Error('가입되지 않은 이메일입니다.'));

    await expect(passwordResetInitApi('wrong@test.com')).rejects.toThrow('가입되지 않은 이메일입니다.');
  });
});
