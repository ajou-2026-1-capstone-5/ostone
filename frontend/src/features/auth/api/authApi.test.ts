import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginApi, signupApi, passwordResetInitApi, logoutApi } from './authApi';

// fetch API를 Mocking합니다.
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    // 매 테스트 전에 mock 초기화
    mockFetch.mockClear();
    // 로컬 스토리지 모킹 (로그아웃 테스트 등에 활용)
    Storage.prototype.getItem = vi.fn(() => 'mock-token');
  });

  it('loginApi 메서드가 올바른 URL(/api/v1/auth/login)과 데이터를 사용하여 fetch를 호출하는지 확인한다', async () => {
    const mockResponse = {
      accessToken: 'dummy-access',
      refreshToken: 'dummy-refresh',
      tokenType: 'Bearer',
      expiresIn: 1800000,
      user: { id: 1, email: 'test@test.com', name: 'Tester', role: 'OPERATOR' }
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await loginApi({ email: 'test@test.com', password: 'password123' });

    // API_BASE === '/api/v1' 이므로, 엔드포인트가 정확한지 검증
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json'
      }),
      body: JSON.stringify({ email: 'test@test.com', password: 'password123' })
    }));

    // 응답 결과 확인
    expect(result.accessToken).toEqual('dummy-access');
    expect(result.user.name).toEqual('Tester');
  });

  it('signupApi 메서드가 올바른 URL(/api/v1/auth/signup)을 호출하는지 확인한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 2, email: 'new@test.com', name: 'NewUser' }),
    });

    const result = await signupApi({ email: 'new@test.com', name: 'NewUser', password: 'pwd' });

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/signup', expect.anything());
    expect(result.email).toEqual('new@test.com');
  });

  it('로그아웃 시 리프레시 토큰을 포함하여 /api/v1/auth/logout 을 호출하는지 확인한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 204, // No Content
    });

    await logoutApi('dummy-refresh');

    expect(mockFetch).toHaveBeenCalledWith('/api/v1/auth/logout', expect.objectContaining({
      body: JSON.stringify({ refreshToken: 'dummy-refresh' })
    }));
  });

  it('passwordResetInitApi 요청 시 에러 응답을 올바르게 던지는지 확인한다', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ code: 'USER_NOT_FOUND', message: '가입되지 않은 이메일입니다.' }),
    });

    // rejects.toThrow 로 예외가 제대로 발생하는지 확인
    await expect(passwordResetInitApi('wrong@test.com')).rejects.toThrow('가입되지 않은 이메일입니다.');
  });
});
