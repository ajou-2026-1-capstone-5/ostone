import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { workspaceApi } from "@/entities/workspace";
import { Spinner } from "@/shared/ui/spinner";

export function WorkspaceRootRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    workspaceApi
      .list()
      .then((workspaces) => {
        if (cancelled) return;
        if (workspaces.length === 0) {
          setTarget("/workspaces/create");
          return;
        }
        const active =
          workspaces.find((w) => w.status === "ACTIVE") ?? workspaces[0];
        setTarget(`/workspaces/${active.id}/workflows`);
      })
      .catch(() => {
        if (!cancelled) setTarget("/login");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (target) {
    return <Navigate to={target} replace />;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
      <Spinner />
    </div>
  );
}
