export function parseRouteId(id: string | undefined): number | null {
  if (id === undefined) return null;
  if (!/^[1-9]\d*$/.test(id)) return null;
  const n = Number(id);
  return Number.isSafeInteger(n) ? n : null;
}
