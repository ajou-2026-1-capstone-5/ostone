export function parseRouteId(id: string | undefined): number | null {
  if (id === undefined) return null;
  if (!/^\d+$/.test(id)) return null;
  const n = parseInt(id, 10);
  if (!Number.isSafeInteger(n) || n <= 0) return null;
  return n;
}
