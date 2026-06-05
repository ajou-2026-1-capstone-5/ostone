import { createContext, useContext } from "react";

const EMPTY_POLICY_NAMES: ReadonlyMap<string, string> = new Map();

/** ACTION 노드가 policyRef를 표시 이름으로 해석할 수 있도록 policyCode → name 맵을 전달한다. */
export const PolicyNameContext = createContext<ReadonlyMap<string, string>>(EMPTY_POLICY_NAMES);

export function usePolicyNames(): ReadonlyMap<string, string> {
  return useContext(PolicyNameContext);
}
