import { apiClient } from './index';

const API_PREFIX = "/api/v1";

export async function customFetch<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const normalizedUrl = url.startsWith('/') ? url : `/${url}`;

  // Strip API prefix if present (generated URLs include /api/v1 but apiClient already adds it)
  const normalizedPath = normalizedUrl.startsWith(`${API_PREFIX}/`)
    ? normalizedUrl.slice(API_PREFIX.length)
    : normalizedUrl;

  return apiClient.request<T>(normalizedPath, options);
}
