import { Outlet, useOutletContext } from "react-router-dom";
import type { ShellContext } from "@/shared/ui/ostone/chrome";

export function DomainPackRouteOutlet() {
  const shellContext = useOutletContext<ShellContext>();

  return <Outlet context={shellContext} />;
}
