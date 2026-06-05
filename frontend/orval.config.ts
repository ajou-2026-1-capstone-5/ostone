import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { defineConfig } from "orval";

const OPENAPI_PATH = resolve(__dirname, "../backend/build/openapi.json");
const META_PATH = resolve(
  __dirname,
  "./src/shared/api/generated/.codegen-meta.json",
);
const PACKAGE_PATH = resolve(__dirname, "./package.json");

const writeCodegenMeta = (): void => {
  if (!existsSync(OPENAPI_PATH)) {
    process.stderr.write(
      `[orval hook] WARN: ${OPENAPI_PATH} not found — skipping .codegen-meta.json update.\n` +
        `             Run \`./gradlew generateOpenApiDocs\` in backend/ before \`pnpm api:gen\`.\n`,
    );
    return;
  }
  const raw = readFileSync(OPENAPI_PATH);
  const hash = `sha256:${createHash("sha256").update(raw).digest("hex")}`;
  let pathsCount = 0;
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    pathsCount = Object.keys(parsed.paths ?? {}).length;
  } catch {
    pathsCount = 0;
  }
  let orvalVersion = "unknown";
  try {
    const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
    orvalVersion =
      pkg.devDependencies?.orval ?? pkg.dependencies?.orval ?? "unknown";
  } catch {
    /* keep default */
  }
  // generatedAt(타임스탬프)은 의도적으로 제외한다. 메타를 입력 결정적으로 유지해
  // CI 의 OpenAPI drift 검사가 단순 `git diff` 로 오탐 없이 동작하게 한다.
  const meta = {
    schemaVersion: 1,
    openapiHash: hash,
    openapiPathsCount: pathsCount,
    orvalVersion,
    openapiSourcePath: "backend/build/openapi.json",
  };
  writeFileSync(META_PATH, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  process.stdout.write(
    `[orval hook] wrote ${META_PATH} (paths=${pathsCount}, hash=${hash.slice(0, 19)}…)\n`,
  );
};

export default defineConfig({
  api: {
    input: {
      target: "../backend/build/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/shared/api/generated/endpoints",
      httpClient: "fetch",
      schemas: {
        type: "zod",
        path: "./src/shared/api/generated/zod",
      },
      client: "react-query",
      clean: false,
      override: {
        mutator: {
          path: "./src/shared/api/mutator.ts",
          name: "customFetch",
        },
        zod: {
          generate: {
            param: true,
            body: true,
            response: true,
            query: true,
            header: true,
          },
        },
      },
    },
    hooks: {
      afterAllFilesWrite: writeCodegenMeta,
    },
  },
});
