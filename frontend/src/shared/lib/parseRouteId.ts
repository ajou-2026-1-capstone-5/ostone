export function parseRouteId(id: string | undefined): number | null {
  if (id === undefined) return null;
  const n = Number(id);
  return Number.isNaN(n) ? null : n;
}
