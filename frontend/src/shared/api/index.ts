export function resolveApiBase(apiBaseUrl: string | undefined): string {
  return apiBaseUrl || "/api/v1";
}

const API_BASE = resolveApiBase(import.meta.env.VITE_API_BASE_URL);

interface ApiError {
  code: string;
  message: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({
        code: "UNKNOWN_ERROR",
        message: "요청 처리 중 오류가 발생했습니다.",
      }))) as ApiError;

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
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async request<T>(path: string, options: RequestInit): Promise<T> {
    let body = options.body;
    if (body && typeof body === "object" && !ArrayBuffer.isView(body as any) && !(body instanceof Blob) && !(body instanceof FormData)) {
      body = JSON.stringify(body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      body,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });
    return this.handleResponse<T>(response);
  }

  async get<T>(path: string, options?: { signal?: AbortSignal }): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "GET",
      headers: this.getHeaders(),
      signal: options?.signal,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
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
