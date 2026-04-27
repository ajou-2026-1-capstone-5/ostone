export default {
  'backend/**/*.java': ['cd backend && ./gradlew spotlessCheck'],
  'frontend/**/*.{ts,tsx}': (filenames) => {
    const filtered = filenames
      .map((f) => f.replace(/\\/g, '/'))
      .filter((f) => !f.includes('/src/shared/api/generated/'));
    if (filtered.length === 0) return [];
    return [
      'cd frontend && pnpm run lint',
      'cd frontend && pnpm run format',
    ];
  },
  'ml/**/*.py': ['cd ml && uv run ruff check', 'cd ml && uv run ruff format', 'cd ml && uv run mypy .'],
}
