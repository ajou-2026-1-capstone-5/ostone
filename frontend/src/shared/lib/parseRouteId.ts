export function parseRouteId(id: string | undefined): number | null {
  if (id === undefined) return null;
  if (!/^\d+$/.test(id)) return null;
  return parseInt(id, 10);
}
