import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXIT,
  backendFailure,
  openapiMissingFailure,
  orvalFailure,
  parseDotenv,
  preconditionErrors,
} from "./codegen.mjs";

test("parseDotenv: KEY=VALUE, skips comments and blanks", () => {
  assert.deepEqual(parseDotenv("# comment\n\nA=1\nB = two \nC=\n"), {
    A: "1",
    B: "two",
    C: "",
  });
});

test("parseDotenv: strips one layer of surrounding quotes", () => {
  assert.deepEqual(parseDotenv("A=\"x y\"\nB='z'"), { A: "x y", B: "z" });
});

test("parseDotenv: keeps '=' inside the value", () => {
  assert.deepEqual(parseDotenv("URL=jdbc:postgresql://h:5432/db?a=b"), {
    URL: "jdbc:postgresql://h:5432/db?a=b",
  });
});

test("preconditionErrors: all satisfied → none", () => {
  assert.deepEqual(
    preconditionErrors({
      hasEnvFile: true,
      jwtSecret: true,
      pgReachable: true,
      port8089Free: true,
    }),
    [],
  );
});

test("preconditionErrors: missing .env → single ENV error", () => {
  const errors = preconditionErrors({
    hasEnvFile: false,
    jwtSecret: true,
    pgReachable: true,
    port8089Free: true,
  });
  assert.equal(errors.length, 1);
  assert.equal(errors[0].code, EXIT.ENV);
  assert.match(errors[0].message, /\.env/);
});

test("preconditionErrors: missing jwt + pg down + port busy → 3 ENV errors", () => {
  const errors = preconditionErrors({
    hasEnvFile: true,
    jwtSecret: false,
    pgReachable: false,
    port8089Free: false,
  });
  assert.equal(errors.length, 3);
  assert.ok(errors.every((e) => e.code === EXIT.ENV));
});

test("backendFailure → exit 10, mentions BACKEND", () => {
  const f = backendFailure(1);
  assert.equal(f.code, 10);
  assert.match(f.message, /BACKEND/);
});

test("openapiMissingFailure → exit 11, includes the path", () => {
  const f = openapiMissingFailure("/x/openapi.json");
  assert.equal(f.code, 11);
  assert.match(f.message, /\/x\/openapi\.json/);
});

test("orvalFailure → exit 20, mentions orval", () => {
  const f = orvalFailure(3);
  assert.equal(f.code, 20);
  assert.match(f.message, /orval/i);
});
