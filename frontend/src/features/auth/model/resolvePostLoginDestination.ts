export const DEFAULT_POST_LOGIN_PATH = "/workspaces";
const ALLOWED_RETURN_PREFIXES = ["/admin", "/workspaces", "/demo/chat", "/demo/workspaces"];

interface ReturnLocation {
  pathname?: unknown;
  search?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractReturnLocation(state: unknown): ReturnLocation | null {
  if (!isRecord(state)) {
    return null;
  }

  const from = state.from;

  if (!isRecord(from)) {
    return null;
  }

  return from;
}

function isExternalUrl(pathname: string): boolean {
  return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(pathname) || pathname.startsWith("//");
}

function isAllowedPath(pathname: string): boolean {
  return ALLOWED_RETURN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function hasDotSegment(pathname: string): boolean {
  return pathname.split("/").some((segment) => {
    try {
      const decoded = decodeURIComponent(segment);
      return decoded === "." || decoded === "..";
    } catch {
      return true;
    }
  });
}

function extractSearch(location: ReturnLocation): string {
  if (typeof location.search !== "string") {
    return "";
  }

  return location.search.startsWith("?") ? location.search : "";
}

export function resolveReturnToPostLoginDestination(state: unknown): string | null {
  const location = extractReturnLocation(state);
  const pathname = location?.pathname;

  if (typeof pathname !== "string" || !pathname || isExternalUrl(pathname)) {
    return null;
  }

  if (hasDotSegment(pathname)) {
    return null;
  }

  if (!isAllowedPath(pathname)) {
    return null;
  }

  return `${pathname}${extractSearch(location)}`;
}

export function resolvePostLoginDestination(state: unknown): string {
  return resolveReturnToPostLoginDestination(state) ?? DEFAULT_POST_LOGIN_PATH;
}
