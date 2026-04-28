import { z } from "zod";

type ExpectedJsonShape = "array" | "object";

function matchesJsonShape(value: string, shape: ExpectedJsonShape): boolean {
  try {
    const parsed: unknown = JSON.parse(value);
    if (shape === "array") {
      return Array.isArray(parsed);
    }
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

export function jsonObjectString(message: string) {
  return z.string().refine((value) => matchesJsonShape(value, "object"), { message });
}

export function jsonArrayString(message: string) {
  return z.string().refine((value) => matchesJsonShape(value, "array"), { message });
}
