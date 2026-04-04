export default {
  'backend/**/*.java': ['cd backend && ./gradlew spotlessCheck'],
  'frontend/**/*.{ts,tsx}': ['cd frontend && pnpm lint', 'cd frontend && pnpm format'],
  'ml/**/*.py': ['ruff check', 'ruff format', 'mypy'],
}
