import {
  clearAuthSession,
  getAccessToken,
  saveAuthTokens,
  type AuthTokens,
} from "@/shared/lib/auth";

export function resolveApiBase(apiBaseUrl: string | undefined): string {
  return apiBaseUrl || "/api/v1";
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);

interface ApiError {
  code: string;
  message: string;
}

interface RequestHeaders {
  headers: Record<string, string>;
  hasSessionAuthHeader: boolean;
}

interface ResponseHandlingOptions {
  clearSessionOnUnauthorized: boolean;
}

function isJsonContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized.includes("application/json") || normalized.includes("+json");
}

function selectTokenRefreshBody(body: unknown): AuthTokens | null {
  const candidate =
    body &&
    typeof body === "object" &&
    "data" in body &&
    (body as { data?: unknown }).data !== undefined
      ? (body as { data: unknown }).data
      : body;

  if (!candidate || typeof candidate !== "object") {
    return null;
  }

  const tokens = candidate as Partial<AuthTokens>;
  if (
    typeof tokens.accessToken !== "string" ||
    typeof tokens.tokenType !== "string" ||
    typeof tokens.expiresIn !== "number"
  ) {
    return null;
  }

  return {
    accessToken: tokens.accessToken,
    tokenType: tokens.tokenType,
    expiresIn: tokens.expiresIn,
  };
}

class ApiClient {
  private baseUrl: string;
  private refreshPromise: Promise<boolean> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private shouldAttachAuthHeader(path: string): boolean {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const pathWithoutApiPrefix = normalizedPath.startsWith("/api/v1/")
      ? normalizedPath.slice("/api/v1".length)
      : normalizedPath;

    const isAuthPath =
      pathWithoutApiPrefix === "/auth" || pathWithoutApiPrefix.startsWith("/auth/");
    const isDemoPath = /^\/workspaces\/[^/]+\/demo(?:\/|$)/.test(pathWithoutApiPrefix);
    return !isAuthPath && !isDemoPath;
  }

  private getHeaders(path: string): RequestHeaders {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    let hasSessionAuthHeader = false;

    if (typeof window !== "undefined" && this.shouldAttachAuthHeader(path)) {
      const token = getAccessToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        hasSessionAuthHeader = true;
      }
    }

    return { headers, hasSessionAuthHeader };
  }

  private withLatestAuthHeader(path: string, init: RequestInit): RequestInit {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token && this.shouldAttachAuthHeader(path)) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return { ...init, headers };
  }

  private async fetchWithSessionRefresh(
    path: string,
    init: RequestInit,
    retryOnUnauthorized: boolean,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, init);
    if (response.status !== 401 || !retryOnUnauthorized) {
      return response;
    }

    const refreshed = await this.refreshAuthSession();
    if (!refreshed) {
      return response;
    }

    return fetch(`${this.baseUrl}${path}`, this.withLatestAuthHeader(path, init));
  }

  async refreshAuthSession(): Promise<boolean> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = this.requestTokenRefresh().finally(() => {
      this.refreshPromise = null;
    });

    return this.refreshPromise;
  }

  private async requestTokenRefresh(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        clearAuthSession();
        return false;
      }

      const tokens = selectTokenRefreshBody(await response.json());
      if (!tokens) {
        clearAuthSession();
        return false;
      }

      saveAuthTokens(tokens);
      return true;
    } catch {
      clearAuthSession();
      return false;
    }
  }

  private async handleResponse<T>(
    response: Response,
    options: ResponseHandlingOptions,
  ): Promise<T> {
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        code: "UNKNOWN_ERROR",
        message: "요청 처리 중 오류가 발생했습니다.",
      }))) as ApiError;

      if (response.status === 401 && options.clearSessionOnUnauthorized) {
        clearAuthSession();
      }

      throw new ApiRequestError(response.status, errorData.code, errorData.message);
    }

    if (response.status === 204 || response.status === 205) {
      return undefined as T;
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!isJsonContentType(contentType)) {
      return undefined as T;
    }

    const bodyText = await response.text();
    if (bodyText.length === 0) {
      return undefined as T;
    }

    return JSON.parse(bodyText) as T;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const { headers, hasSessionAuthHeader } = this.getHeaders(path);
    const response = await this.fetchWithSessionRefresh(
      path,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      },
      hasSessionAuthHeader,
    );

    return this.handleResponse<T>(response, {
      clearSessionOnUnauthorized: hasSessionAuthHeader,
    });
  }

  async request<T>(path: string, options: RequestInit): Promise<T> {
    let body = options.body;
    if (
      body &&
      typeof body === "object" &&
      !ArrayBuffer.isView(body as ArrayBufferView | null) &&
      !(body instanceof Blob) &&
      !(body instanceof FormData) &&
      !(body instanceof URLSearchParams)
    ) {
      body = JSON.stringify(body);
    }

    const { headers: baseHeaders, hasSessionAuthHeader } = this.getHeaders(path);
    const headers = new Headers(baseHeaders);
    if (body instanceof FormData || body instanceof Blob || body instanceof URLSearchParams) {
      headers.delete("Content-Type");
    }
    if (options.headers) {
      const extra =
        options.headers instanceof Headers ? Object.fromEntries(options.headers) : options.headers;
      new Headers(extra).forEach((v, k) => headers.set(k, v));
    }

    const response = await this.fetchWithSessionRefresh(
      path,
      {
        ...options,
        body,
        headers,
      },
      hasSessionAuthHeader,
    );
    return this.handleResponse<T>(response, {
      clearSessionOnUnauthorized: hasSessionAuthHeader,
    });
  }

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
    const { headers, hasSessionAuthHeader } = this.getHeaders(path);
    const response = await this.fetchWithSessionRefresh(
      path,
      {
        method: "GET",
        headers,
        signal: options?.signal,
      },
      hasSessionAuthHeader,
    );

    return this.handleResponse<T>(response, {
      clearSessionOnUnauthorized: hasSessionAuthHeader,
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const { headers, hasSessionAuthHeader } = this.getHeaders(path);
    const response = await this.fetchWithSessionRefresh(
      path,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
      hasSessionAuthHeader,
    );

    return this.handleResponse<T>(response, {
      clearSessionOnUnauthorized: hasSessionAuthHeader,
    });
  }

  async delete<T>(path: string): Promise<T> {
    const { headers, hasSessionAuthHeader } = this.getHeaders(path);
    const response = await this.fetchWithSessionRefresh(
      path,
      {
        method: "DELETE",
        headers,
      },
      hasSessionAuthHeader,
    );

    return this.handleResponse<T>(response, {
      clearSessionOnUnauthorized: hasSessionAuthHeader,
    });
  }
}

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

export const apiClient = new ApiClient(API_BASE);
export function refreshAuthSession(): Promise<boolean> {
  return apiClient.refreshAuthSession();
}
export { requireApiData, selectApiData, selectApiList } from "./apiResponse";
export {
  billingQueryKeys,
  domainPackQueryKeys,
  intentQueryKeys,
  policyQueryKeys,
  riskQueryKeys,
  slotQueryKeys,
  workspaceMemberQueryKeys,
  workflowQueryKeys,
} from "./queryKeys";
export { unwrapApiResponse } from "./unwrapApiResponse";
