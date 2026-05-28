export function deriveAvatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const firstChar = trimmed[0];
  if (/[가-힣]/.test(firstChar)) return firstChar;
  return trimmed.slice(0, 2).toUpperCase();
}
