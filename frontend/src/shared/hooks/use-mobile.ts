import { useIsBelow } from "./use-media-query";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  return useIsBelow(MOBILE_BREAKPOINT);
}
