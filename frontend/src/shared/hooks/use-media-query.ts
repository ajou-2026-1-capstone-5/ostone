import * as React from "react";

/**
 * Subscribe to a CSS media query. SSR-safe: returns `false` until mounted.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return !!matches;
}

/**
 * True when the viewport is narrower than `maxWidthPx` (exclusive),
 * e.g. `useIsBelow(1180)` matches `(max-width: 1179px)`.
 */
export function useIsBelow(maxWidthPx: number): boolean {
  return useMediaQuery(`(max-width: ${maxWidthPx - 1}px)`);
}
