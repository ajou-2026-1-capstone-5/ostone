import type { Page } from "@playwright/test";

function encodeBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function makeJwt(): string {
  const header = encodeBase64Url({ alg: "none", typ: "JWT" });
  const payload = encodeBase64Url({ exp: Math.floor(Date.now() / 1000) + 60 * 60 });
  return `${header}.${payload}.e2e`;
}

export async function installAuth(page: Page) {
  const token = makeJwt();
  await page.addInitScript((accessToken) => {
    window.localStorage.setItem("accessToken", accessToken);
    window.localStorage.setItem("refreshToken", "e2e-refresh-token");
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: 7, email: "agent@example.com", name: "상담사", role: "OPERATOR" }),
    );
  }, token);
}
