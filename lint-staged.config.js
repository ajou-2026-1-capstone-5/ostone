export default {
  "backend/**/*.java": () => "pnpm run format:backend:check",
  "frontend/**/*.{ts,tsx}": (filenames) => {
    const filtered = filenames
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("/src/shared/api/generated/"));
    if (filtered.length === 0) return [];
    return ["pnpm run lint:frontend", "pnpm run format:frontend"];
  },
  "ml/**/*.py": [
    "pnpm run lint:ml",
    "pnpm run format:ml",
    "pnpm run typecheck:ml",
  ],
};
