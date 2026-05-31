const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";
const USER_KEY = "user";

const memoryStorage = new Map<string, string>();

function getStorage(): Storage | null {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const probeKey = "__ostone_storage_probe__";
    localStorage.setItem(probeKey, "1");
    localStorage.removeItem(probeKey);
    return localStorage;
  } catch {
    return null;
  }
}

function setAuthValue(key: string, value: string): void {
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, value);
    return;
  }

  memoryStorage.set(key, value);
}

function getAuthValue(key: string): string | null {
  return getStorage()?.getItem(key) ?? memoryStorage.get(key) ?? null;
}

function removeAuthValue(key: string): void {
  getStorage()?.removeItem(key);
  memoryStorage.delete(key);
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export function saveAuthSession(tokens: AuthTokens, user: AuthUser): void {
  setAuthValue(ACCESS_TOKEN_KEY, tokens.accessToken);
  setAuthValue(REFRESH_TOKEN_KEY, tokens.refreshToken);
  setAuthValue(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession(): void {
  removeAuthValue(ACCESS_TOKEN_KEY);
  removeAuthValue(REFRESH_TOKEN_KEY);
  removeAuthValue(USER_KEY);
}

export function getAccessToken(): string | null {
  return getAuthValue(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return getAuthValue(REFRESH_TOKEN_KEY);
}

export function getAuthUser(): AuthUser | null {
  const raw = getAuthValue(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function normalizeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddingLength = (4 - (base64.length % 4)) % 4;

  return `${base64}${"=".repeat(paddingLength)}`;
}

export function isAuthenticated(): boolean {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(normalizeBase64Url(token.split(".")[1] ?? "")));
    const exp = payload.exp;

    return typeof exp === "number" && exp > Date.now() / 1000;
  } catch {
    return false;
  }
}
