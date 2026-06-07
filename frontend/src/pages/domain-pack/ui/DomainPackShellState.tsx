import { useEffect, type ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
import type { Crumb, ShellContext } from "@/shared/ui/ostone/chrome";

interface DomainPackShellStateProps {
  crumbs: Crumb[];
  topbarRight?: ReactNode;
  children: ReactNode;
}

const EMPTY_CRUMBS: Crumb[] = [];

export function DomainPackShellState({
  crumbs,
  topbarRight,
  children,
}: DomainPackShellStateProps) {
  const { setCrumbs, setTopbarRight } = useOutletContext<ShellContext>();

  useEffect(() => {
    setCrumbs(crumbs);
    setTopbarRight(topbarRight);

    return () => {
      setCrumbs(EMPTY_CRUMBS);
      setTopbarRight(undefined);
    };
  }, [crumbs, setCrumbs, setTopbarRight, topbarRight]);

  return <>{children}</>;
}
