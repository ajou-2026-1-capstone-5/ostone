export default {
  'backend/**/*.java': ['cd backend && ./gradlew spotlessCheck'],
  'frontend/**/*.{ts,tsx}': ['cd frontend && pnpm run lint', 'cd frontend && pnpm run format'],
  'ml/**/*.py': ['cd ml && ruff check', 'cd ml && ruff format', 'cd ml && mypy .'],
}
