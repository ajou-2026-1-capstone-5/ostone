import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { mapWorkspaceActionError, workspaceApi, type WorkspaceResponse } from "@/entities/workspace";
import {
  ArchiveConfirmDialog,
  CreateWorkspaceDialog,
  EditWorkspaceDialog,
} from "@/features/workspace";
import { AppShell } from "@/widgets/app-shell";

export function WorkspaceListPage() {
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState<WorkspaceResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<WorkspaceResponse | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<WorkspaceResponse | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await workspaceApi.list();
      setWorkspaces(data.filter((workspace) => workspace.status === "ACTIVE"));
    } catch (err) {
      setError(mapWorkspaceActionError(err) || "서버에 연결할 수 없습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWorkspaces();
  }, [fetchWorkspaces]);

  const handleOpenWorkspace = (workspace: WorkspaceResponse) => {
    navigate(`/workspaces/${workspace.id}/workflows`);
  };

  return (
    <AppShell>
      <div className="flex flex-col flex-1 min-w-0 overflow-auto">
        {/* Hero strip */}
        <div className="px-6 py-5 border-b border-[var(--line)]">
          <div className="flex items-center gap-6">
            {[
              { label: "Total workspaces", value: workspaces.length },
              { label: "Active", value: workspaces.filter(w => w.status === "ACTIVE").length },
              { label: "Archived", value: workspaces.filter(w => w.status === "ARCHIVED").length },
              { label: "Loading", value: isLoading ? "..." : "Ready" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)]">{stat.label}</div>
                <div className="text-xl font-medium tabular-nums" style={{fontFamily:'var(--mono)'}}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main content: table + right rail */}
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {/* Toolbar: search + filter + sort */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-[var(--line)]">
              <input
                className="flex-1 max-w-[260px] h-8 px-3 text-xs border border-[var(--line)] rounded-md bg-transparent text-[var(--ink)] placeholder:text-[var(--ink-3)]"
                placeholder="Search workspaces... ⌘K"
                onChange={(_e) => {/* client-side filter */}}
              />
              <div className="flex gap-1">
                {["All", "Active", "Mine", "Archived"].map(tab => (
                  <button key={tab} className="px-3 py-1 text-[11px] rounded-full border border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--paper-2)]">
                    {tab}
                  </button>
                ))}
              </div>
              <select className="h-8 px-2 text-[11px] border border-[var(--line)] rounded-md bg-transparent text-[var(--ink-2)]">
                <option>Recently updated</option>
                <option>Name</option>
                <option>Members</option>
              </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="p-6 text-xs text-[var(--ink-3)]">Loading...</div>
              ) : error ? (
                <div className="p-6 text-xs text-[var(--danger)]">{error}</div>
              ) : workspaces.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-[var(--ink-3)]">
                  <div className="text-2xl">📋</div>
                  <div className="text-xs">워크스페이스가 없습니다</div>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[var(--line)] text-[var(--ink-3)]">
                      <th className="text-left px-6 py-2 font-normal">Name</th>
                      <th className="text-left px-3 py-2 font-normal">Key</th>
                      <th className="text-left px-3 py-2 font-normal">Role</th>
                      <th className="text-left px-3 py-2 font-normal">Status</th>
                      <th className="text-left px-3 py-2 font-normal">Updated</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspaces.map((ws) => (
                      <tr
                        key={ws.id}
                        className="border-b border-[var(--line)] hover:bg-[var(--paper-2)] cursor-pointer transition-colors"
                        onDoubleClick={() => handleOpenWorkspace(ws)}
                      >
                        <td className="px-6 py-2.5 text-[var(--ink)]">{ws.name}</td>
                        <td className="px-3 py-2.5 text-[var(--ink-2)]" style={{fontFamily:'var(--mono)'}}>{ws.workspaceKey}</td>
                        <td className="px-3 py-2.5 text-[var(--ink-2)]">{ws.myRole || "-"}</td>
                        <td className="px-3 py-2.5 text-[var(--ink-2)]">{ws.status}</td>
                        <td className="px-3 py-2.5 text-[var(--ink-3)]">{ws.updatedAt ? new Date(ws.updatedAt).toLocaleDateString() : "-"}</td>
                        <td className="px-3 py-2.5">
                          <button
                            className="text-[var(--ink-3)] hover:text-[var(--ink)]"
                            onClick={(e) => { e.stopPropagation(); /* context menu */ }}
                          >···</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right rail */}
          <div className="w-[300px] border-l border-[var(--line)] p-4 flex flex-col gap-4 overflow-auto">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-2">Coverage</div>
              <div className="text-lg font-medium" style={{fontFamily:'var(--mono)'}}>87%</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-3)] mb-2">Drafts to review</div>
              <div className="text-xs text-[var(--ink-2)]">No pending drafts</div>
            </div>
            <button
              className="mt-auto w-full py-2 text-[11px] rounded-full bg-[var(--ink)] text-[var(--paper)] hover:opacity-90 transition-opacity"
              onClick={() => setIsCreateOpen(true)}
            >
              새 워크스페이스
            </button>
          </div>
        </div>
      </div>

      <CreateWorkspaceDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={fetchWorkspaces}
      />
      <EditWorkspaceDialog
        workspace={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
      <ArchiveConfirmDialog
        workspace={archiveTarget}
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
          }
        }}
        onSuccess={fetchWorkspaces}
      />
    </AppShell>
  );
}
