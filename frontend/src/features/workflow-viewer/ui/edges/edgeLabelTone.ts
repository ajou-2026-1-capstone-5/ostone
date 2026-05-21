/**
 * Classify an edge label string as positive (yes) / negative (no) / neutral
 * so PlainEdge can paint a left-dot color hint on the pill badge.
 *
 * No-patterns are evaluated first so phrases like "일치하지 않음"
 * (which lexically contains the yes-token "일치") are not mis-classified.
 */
const YES_PATTERNS: readonly RegExp[] = [
  /\byes\b/i,
  /\btrue\b/i,
  /\bok\b/i,
  /\bmatch\b/i,
  /\bvip\b/i,
  /있음/,
  /일치(?!하지)/,
];

const NO_PATTERNS: readonly RegExp[] = [
  /\bno\b/i,
  /\bfalse\b/i,
  /\bfail\b/i,
  /\bmiss\b/i,
  /\bfallback\b/i,
  /없음/,
  /불일치/,
  /일치하지\s*않/,
];

export type EdgeLabelTone = "yes" | "no" | "neutral";

export function classifyLabelTone(label: unknown): EdgeLabelTone {
  if (typeof label !== "string") return "neutral";
  const trimmed = label.trim();
  if (trimmed === "") return "neutral";
  if (NO_PATTERNS.some((re) => re.test(trimmed))) return "no";
  if (YES_PATTERNS.some((re) => re.test(trimmed))) return "yes";
  return "neutral";
}
