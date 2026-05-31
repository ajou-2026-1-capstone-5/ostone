export function formatWaitDuration(minutes: number): string {
  const safeMinutes = Math.max(0, Math.floor(minutes));

  if (safeMinutes >= 60 * 24) {
    return `${Math.floor(safeMinutes / (60 * 24))}일`;
  }

  if (safeMinutes >= 60) {
    return `${Math.floor(safeMinutes / 60)}시간`;
  }

  return `${safeMinutes}분`;
}
