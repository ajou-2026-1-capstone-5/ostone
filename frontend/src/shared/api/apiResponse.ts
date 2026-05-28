import { unwrapApiResponse } from "./unwrapApiResponse";

export function selectApiData<T>(response: T | { data?: T } | undefined): T | undefined {
  return unwrapApiResponse<T>(response);
}

export function selectApiList<T>(response: T[] | { data?: T[] } | undefined): T[] {
  return selectApiData<T[]>(response) ?? [];
}

export function requireApiData<T>(response: T | { data?: T } | undefined, message: string): T {
  const data = selectApiData<T>(response);
  if (data === undefined) {
    throw new Error(message);
  }
  return data;
}
