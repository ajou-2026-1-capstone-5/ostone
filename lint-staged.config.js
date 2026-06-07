export default {
  "backend/**/*.java": ["pnpm run format:backend:check"],
  "frontend/**/*.{ts,tsx}": (filenames) => {
    const filtered = filenames
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("/src/shared/api/generated/"));
    if (filtered.length === 0) return [];
    return ["pnpm run lint:frontend", "pnpm run format:frontend"];
  },
  // ml 검사는 디렉터리 전체 명령이므로 함수형으로 staged 파일 인자 전달을 막는다.
  // 배열형이면 `mypy . <파일>`이 되어 항상 duplicate module 오류로 실패한다.
  "ml/**/*.py": () => [
    "pnpm run lint:ml",
    "pnpm run format:ml:check",
    "pnpm run typecheck:ml",
  ],
};
