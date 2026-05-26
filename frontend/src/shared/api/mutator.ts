import { apiClient } from "./index";
import { resolveMock } from "./mocks";

const API_PREFIX = "/api/v1";

export async function customFetch<T>(url: string, options: RequestInit): Promise<T> {
  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;

  // Strip API prefix if present (generated URLs include /api/v1 but apiClient already adds it)
  const hasExactPrefix = normalizedUrl === API_PREFIX || normalizedUrl.startsWith(API_PREFIX + "/");
  const stripped = hasExactPrefix ? normalizedUrl.slice(API_PREFIX.length) : null;
  const normalizedPath = stripped === "" ? "/" : (stripped ?? normalizedUrl);

  const mocked = resolveMock<T>(normalizedPath, options);
  if (mocked !== null) {
    return Promise.resolve(mocked);
  }

  return apiClient.request<T>(normalizedPath, options);
}
