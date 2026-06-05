import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_RUNNER = join(
  ROOT,
  "backend/src/main/java/com/init/domainpack/infrastructure/ActiveVentureDomainPackSeedRunner.java",
);
const README = join(ROOT, "README.md");

// seed runner 소스에서 데모 로그인 이메일을 추출(중복 제거 + 정렬).
export function extractDemoEmails(javaSource) {
  const matches = javaSource.match(/[a-z0-9.]+\.demo@ostone\.local/g) ?? [];
  return [...new Set(matches)].sort();
}

// DEMO_SIGN_IN_VALUE = String.join("", "demo", "1234") → "demo1234" 로 재구성.
export function extractDemoPassword(javaSource) {
  const m = javaSource.match(
    /DEMO_SIGN_IN_VALUE\s*=\s*String\.join\(\s*""\s*,\s*([^)]*)\)/,
  );
  if (!m) return null;
  return [...m[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("");
}

test("README documents every demo email and the seeded password", () => {
  const java = readFileSync(SEED_RUNNER, "utf8");
  const readme = readFileSync(README, "utf8");

  const emails = extractDemoEmails(java);
  const password = extractDemoPassword(java);

  assert.ok(
    emails.length >= 2,
    `expected >=2 demo emails in seed runner, got ${emails.length}`,
  );
  assert.ok(
    password,
    "could not reconstruct DEMO_SIGN_IN_VALUE from the seed runner",
  );

  for (const email of emails) {
    assert.ok(
      readme.includes(email),
      `README must document demo email ${email}`,
    );
  }
  assert.ok(
    readme.includes(password),
    `README must document the demo password "${password}" (from DEMO_SIGN_IN_VALUE)`,
  );
});

test("extractDemoPassword reconstructs the String.join concatenation", () => {
  assert.equal(
    extractDemoPassword(
      'private static final String DEMO_SIGN_IN_VALUE = String.join("", "demo", "1234");',
    ),
    "demo1234",
  );
  assert.equal(extractDemoPassword("String x = 1;"), null);
});

test("extractDemoEmails dedupes and sorts", () => {
  const src = "a.demo@ostone.local x b.demo@ostone.local y a.demo@ostone.local";
  assert.deepEqual(extractDemoEmails(src), [
    "a.demo@ostone.local",
    "b.demo@ostone.local",
  ]);
});
