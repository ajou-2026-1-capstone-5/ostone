export default {
  'backend/**/*.java': ['cd backend && ./gradlew spotlessCheck'],
  'frontend/**/*.{ts,tsx}': ['cd frontend && pnpm run lint', 'cd frontend && pnpm run format'],
  'ml/**/*.py': ['cd ml && uv run ruff check', 'cd ml && uv run ruff format', 'cd ml && uv run mypy .'],
}
