import { ZodError } from "zod";
import { describe, expect, it } from "vite-plus/test";
import * as generatedZod from "./generated/zod";

type ParseableSchema = {
  parse: (input: unknown) => unknown;
  safeParse: (input: unknown) => { success: boolean };
};

type EndpointModule = Record<string, unknown>;
type EndpointExportEntry = [string, unknown];

const INVALID_INPUT = { __invalid__: true };

function getGeneratedZodExports(): unknown[] {
  return Object.values(generatedZod) as unknown[];
}

function getParseableSchemas(): ParseableSchema[] {
  return getGeneratedZodExports().filter(isParseableSchema);
}

function isParseableSchema(value: unknown): value is ParseableSchema {
  return typeof value === "object"
    && value !== null
    && "parse" in value
    && typeof value.parse === "function"
    && "safeParse" in value
    && typeof value.safeParse === "function";
}

describe("Generated API code smoke test", () => {
  it("generated zod 모듈을 import할 수 있다", () => {
    const exports = getGeneratedZodExports();

    expect(exports.length).toBeGreaterThan(0);
    expect(exports.some(isParseableSchema)).toBe(true);
  });

  it("generated endpoints 모듈이 TanStack Query hook을 export한다", () => {
    const endpointModules = import.meta.glob("./generated/endpoints/**/*.ts", {
      eager: true,
    }) as Record<string, EndpointModule>;
    const exports = Object.values(endpointModules).flatMap(
      (endpointModule) => Object.entries(endpointModule) as EndpointExportEntry[],
    );
    const hookExports = exports.filter(([name, value]) =>
      name.startsWith("use") && typeof value === "function",
    );

    expect(Object.keys(endpointModules).length).toBeGreaterThan(0);
    expect(hookExports.length).toBeGreaterThan(0);
  });

  it("dynamic discovery로 찾은 zod schema가 invalid input에서 ZodError를 던진다", () => {
    const schema = getParseableSchemas().find(
      (candidate) => !candidate.safeParse(INVALID_INPUT).success,
    );

    expect(schema).toBeDefined();

    if (!schema) {
      throw new Error("invalid input을 거부하는 generated zod schema를 찾지 못했습니다.");
    }

    expect(() => schema.parse(INVALID_INPUT)).toThrow(ZodError);
  });
});
