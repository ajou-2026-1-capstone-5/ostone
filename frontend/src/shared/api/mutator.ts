import { apiClient } from './index';

export async function customFetch<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

  return apiClient.request<T>(normalizedUrl, options);
}
