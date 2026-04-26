import { defineConfig } from "orval";

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
  },
});
