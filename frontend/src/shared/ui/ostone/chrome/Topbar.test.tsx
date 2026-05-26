import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Topbar } from "./Topbar";

function renderTopbar(...args: Parameters<typeof Topbar>) {
  return render(
    <MemoryRouter>
      <Topbar {...args[0]} />
    </MemoryRouter>,
  );
}

describe("Topbar", () => {
  it("renders CStone brand", () => {
    renderTopbar({ crumbs: [] });
    const brand = screen.getByText("CStone");
    expect(brand).toBeInTheDocument();
    expect(brand).toHaveStyle({
      height: "20px",
      textTransform: "none",
      alignItems: "center",
    });
  });

  it("renders left and right slots on the same topbar row", () => {
    renderTopbar({
      crumbs: ["Domain Packs"],
      left: <span>Workspace A</span>,
      right: <button type="button">CTA</button>,
    });

    expect(screen.getByText("Workspace A")).toBeInTheDocument();
    expect(screen.getByText("CTA")).toBeInTheDocument();
    expect(screen.getByText("Domain Packs")).toHaveStyle({
      height: "20px",
      alignItems: "center",
    });
  });

  it("renders breadcrumbs with last item bold", () => {
    const { container } = renderTopbar({
      crumbs: ["CARD-CS", "Domain Packs", "Refund flow"],
    });
    const crumbs = container.querySelectorAll(".crumb");
    expect(crumbs.length).toBe(3);

    const lastCrumb = crumbs[crumbs.length - 1] as HTMLElement;
    expect(lastCrumb.style.fontWeight).toBe("500");
  });

  it("renders right slot", () => {
    renderTopbar({ crumbs: [], right: <button type="button">CTA</button> });
    expect(screen.getByText("CTA")).toBeInTheDocument();
  });

  it("crumb with href (non-last) renders as anchor with that href", () => {
    renderTopbar({
      crumbs: [
        { label: "Pack X", href: "/workspaces/1/domain-packs/9" },
        {
          label: "INTENTS",
          href: "/workspaces/1/domain-packs/9/intents?versionId=1",
        },
        { label: "current" },
      ],
    });
    const linkA = screen.getByText("Pack X") as HTMLAnchorElement;
    expect(linkA.tagName).toBe("A");
    expect(linkA.getAttribute("href")).toBe("/workspaces/1/domain-packs/9");
    expect(linkA).toHaveStyle({ height: "20px", alignItems: "center" });
    fireEvent.mouseEnter(linkA);
    fireEvent.mouseLeave(linkA);
    expect(linkA).toHaveStyle({ textDecoration: "none" });

    const linkB = screen.getByText("INTENTS") as HTMLAnchorElement;
    expect(linkB.tagName).toBe("A");
    expect(linkB.getAttribute("href")).toBe(
      "/workspaces/1/domain-packs/9/intents?versionId=1",
    );

    const last = screen.getByText("current");
    expect(last.tagName).not.toBe("A");
  });

  it("crumb with href on last item renders as span (not clickable)", () => {
    renderTopbar({
      crumbs: [{ label: "first" }, { label: "last", href: "/somewhere" }],
    });
    const last = screen.getByText("last");
    expect(last.tagName).toBe("SPAN");
  });
});
