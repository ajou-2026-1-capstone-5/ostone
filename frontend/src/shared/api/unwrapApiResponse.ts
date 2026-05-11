export function unwrapApiResponse<T>(response: T | { data?: T }): T {
  if (
    response &&
    typeof response === "object" &&
    "data" in response &&
    (response as { data?: T }).data !== undefined
  ) {
    return (response as { data: T }).data;
  }

  return response as T;
}
