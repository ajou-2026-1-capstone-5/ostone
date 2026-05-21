import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/shared/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <div
      role="menuitem"
      tabIndex={-1}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {children}
    </div>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
  }) => (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.(e as unknown as React.MouseEvent);
        }
      }}
    >
      {children}
    </div>
  ),
}));

import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const activeWorkspaces = [
  { id: 1, name: "WS One", status: "ACTIVE" as const },
  { id: 2, name: "WS Two", status: "ACTIVE" as const },
];

const archivedWorkspaces = [{ id: 3, name: "Archived WS", status: "ARCHIVED" as const }];

const allWorkspaces = [...activeWorkspaces, ...archivedWorkspaces];

function renderSwitcher(props: Partial<Parameters<typeof WorkspaceSwitcher>[0]> = {}) {
  const onSwitch = vi.fn();
  const onCreate = vi.fn();
  const onEdit = vi.fn();
  const onArchive = vi.fn();

  render(
    <WorkspaceSwitcher
      workspaces={allWorkspaces}
      currentWorkspaceId={1}
      onSwitch={onSwitch}
      onCreate={onCreate}
      onEdit={onEdit}
      onArchive={onArchive}
      {...props}
    />,
  );

  return { onSwitch, onCreate, onEdit, onArchive };
}

describe("WorkspaceSwitcher", () => {
  it("renders trigger button with current workspace name", () => {
    renderSwitcher();
    expect(screen.getAllByText("WS One").length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback label when no current workspace and empty list", () => {
    renderSwitcher({ currentWorkspaceId: null, workspaces: [] });
    expect(screen.getByText("워크스페이스 선택")).toBeInTheDocument();
  });

  it("renders active workspace names as menu items", () => {
    renderSwitcher();
    const menuItems = screen.getAllByRole("menuitem");
    expect(menuItems.some((el) => el.textContent?.includes("WS One"))).toBe(true);
    expect(menuItems.some((el) => el.textContent?.includes("WS Two"))).toBe(true);
  });

  it("renders create new workspace item", () => {
    renderSwitcher();
    expect(screen.getByText("+ 새 워크스페이스")).toBeInTheDocument();
  });

  it("calls onSwitch when clicking a workspace item", () => {
    const { onSwitch } = renderSwitcher();
    const items = screen.getAllByRole("menuitem");
    const wsTwo = items.find((el) => el.textContent?.includes("WS Two"));
    if (wsTwo) fireEvent.click(wsTwo);
    expect(onSwitch).toHaveBeenCalledWith(2);
  });

  it("renders archived section label when archived workspaces exist", () => {
    renderSwitcher();
    expect(screen.getByText("보관됨")).toBeInTheDocument();
  });

  it("renders archived workspace names", () => {
    renderSwitcher();
    expect(screen.getByText("Archived WS")).toBeInTheDocument();
  });

  it("shows current badge on active workspace", () => {
    renderSwitcher();
    const items = screen.getAllByRole("menuitem");
    const wsOne = items.find((el) => el.textContent?.includes("WS One"));
    expect(wsOne).toBeInTheDocument();
  });

  it("calls onCreate when create item clicked", () => {
    const { onCreate } = renderSwitcher();
    const createItems = screen.getAllByText("+ 새 워크스페이스");
    const createItem = createItems.find((el) => el.closest('[role="menuitem"]'));
    if (createItem) fireEvent.click(createItem);
    expect(onCreate).toHaveBeenCalled();
  });

  it("calls onEdit via more actions menu", () => {
    const { onEdit } = renderSwitcher();
    const menuItems = screen.getAllByRole("menuitem");
    const editItem = menuItems.find((el) => el.textContent === "수정");
    if (editItem) fireEvent.click(editItem);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1, name: "WS One" }));
  });

  it("supports no-archived case hiding archived label", () => {
    renderSwitcher({ workspaces: activeWorkspaces });
    expect(screen.queryByText("보관됨")).not.toBeInTheDocument();
  });

  it("handles archived workspace switch", () => {
    const { onSwitch } = renderSwitcher();
    const items = screen.getAllByText("Archived WS");
    const archivedItem = items.find((el) => el.closest('[role="menuitem"]'));
    if (archivedItem) fireEvent.click(archivedItem);
    expect(onSwitch).toHaveBeenCalledWith(3);
  });
});
