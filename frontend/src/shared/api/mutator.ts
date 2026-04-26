import { apiClient, resolveApiBase } from './index';

const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);

export async function customFetch<T>(
  url: string,
  options: {
    method: string;
    params?: Record<string, unknown>;
    data?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
): Promise<T> {
  const { method, params, data, signal } = options;

  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

  let fullUrl = normalizedUrl;
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    fullUrl = `${normalizedUrl}?${searchParams.toString()}`;
  }

  if (method === 'GET') {
    return apiClient.get<T>(fullUrl, { signal });
  }

  if (method === 'POST') {
    return apiClient.post<T>(fullUrl, data);
  }

  if (method === 'PATCH') {
    return apiClient.patch<T>(fullUrl, data);
  }

  if (method === 'DELETE') {
    return apiClient.delete<T>(fullUrl);
  }

  if (method === 'PUT') {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    return fetch(`${API_BASE}${fullUrl}`, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
      signal,
    }).then(async (response) => {
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          code: 'UNKNOWN_ERROR',
          message: '요청 처리 중 오류가 발생했습니다.',
        }))) as { code: string; message: string };

        const { ApiRequestError } = await import('./index');
        throw new ApiRequestError(
          response.status,
          errorData.code,
          errorData.message,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return response.json() as Promise<T>;
    });
  }

  throw new Error(`Unsupported method: ${method}`);
}