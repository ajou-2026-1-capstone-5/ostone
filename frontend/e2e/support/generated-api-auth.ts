import type { Page } from "@playwright/test";

type E2eUserRole = "OPERATOR" | "ADMIN" | "SUPER_ADMIN";

interface InstallAuthOptions {
  role?: E2eUserRole;
  name?: string;
  email?: string;
}

const AUTH_SEEDED_KEY = "e2e-auth-seeded";

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function makeJwt(
  role: E2eUserRole = "OPERATOR",
  expiresAt = Math.floor(Date.now() / 1000) + 60 * 60,
): string {
  const header = encodeBase64Url({ alg: "none", typ: "JWT" });
  const payload = encodeBase64Url({
    exp: expiresAt,
    role,
  });
  return `${header}.${payload}.e2e`;
}

export async function installAuth(page: Page, options: InstallAuthOptions = {}) {
  const role = options.role ?? "OPERATOR";
  const token = makeJwt(role);
  const user = {
    id: role === "SUPER_ADMIN" ? 1 : 7,
    email: options.email ?? (role === "SUPER_ADMIN" ? "admin@example.com" : "agent@example.com"),
    name: options.name ?? (role === "SUPER_ADMIN" ? "관리자" : "상담사"),
    role,
  };

  await page.addInitScript(
    ({ accessToken, seededKey, user }) => {
      if (window.sessionStorage.getItem(seededKey) === "true") {
        return;
      }
      window.sessionStorage.setItem(seededKey, "true");
      window.localStorage.setItem("accessToken", accessToken);
      window.localStorage.setItem("refreshToken", "e2e-refresh-token");
      window.localStorage.setItem("user", JSON.stringify(user));
    },
    { accessToken: token, seededKey: AUTH_SEEDED_KEY, user },
  );
}
