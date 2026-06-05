import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  isJarStale,
  newestMtimeMs,
  resolveMode,
} from "./preflight-backend-jar.mjs";

test("isJarStale: source newer than jar → stale", () => {
  assert.equal(isJarStale(100, 200), true);
});

test("isJarStale: jar newer than source → not stale", () => {
  assert.equal(isJarStale(200, 100), false);
});

test("isJarStale: equal mtimes → not stale", () => {
  assert.equal(isJarStale(100, 100), false);
});

test("resolveMode: missing jar", () => {
  assert.equal(
    resolveMode({ jarExists: false, jarMtimeMs: 0, srcMtimeMs: 50 }),
    "missing",
  );
});

test("resolveMode: stale jar (source newer)", () => {
  assert.equal(
    resolveMode({ jarExists: true, jarMtimeMs: 10, srcMtimeMs: 50 }),
    "stale",
  );
});

test("resolveMode: fresh jar (jar newer)", () => {
  assert.equal(
    resolveMode({ jarExists: true, jarMtimeMs: 50, srcMtimeMs: 10 }),
    "fresh",
  );
});

test("newestMtimeMs: nonexistent paths → 0", () => {
  assert.equal(newestMtimeMs(["/nonexistent/path/xyz-preflight-test"]), 0);
});

test("newestMtimeMs: a real file returns a positive mtime", () => {
  const self = fileURLToPath(import.meta.url);
  assert.ok(newestMtimeMs([self]) > 0);
});
