export function unwrapApiResponse(response: undefined): undefined;
export function unwrapApiResponse<T>(response: T | { data?: T }): T;
export function unwrapApiResponse<T>(response: T | { data?: T } | undefined): T | undefined;
export function unwrapApiResponse<T>(response: T | { data?: T } | undefined): T | undefined {
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
