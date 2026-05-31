import type { DemoCompany } from "../model/demoCompanies";

interface CompanyCardProps {
  company: DemoCompany;
  active: boolean;
  onActivate: (company: DemoCompany) => void;
}

export function CompanyCard({ company, active, onActivate }: CompanyCardProps) {
  const disabled = !company.enabled;

  return (
    <button
      type="button"
      data-testid={`demo-company-card-${company.workspaceId}`}
      aria-pressed={active}
      aria-disabled={disabled}
      onClick={() => onActivate(company)}
      onMouseEnter={() => onActivate(company)}
      onFocus={() => onActivate(company)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "100%",
        textAlign: "left",
        padding: "18px 18px",
        borderRadius: 8,
        cursor: "pointer",
        background: "var(--paper)",
        border: active ? "1px solid var(--ink)" : "1px solid var(--line)",
        boxShadow: active ? "0 0 0 3px rgba(15, 23, 42, 0.08)" : "none",
        color: "var(--ink)",
        font: "inherit",
        transition: "border-color 120ms ease, box-shadow 120ms ease",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <span
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--ink-3)",
          }}
        >
          Workspace #{company.workspaceId}
        </span>
        <span
          data-testid={`demo-company-status-${company.workspaceId}`}
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            padding: "2px 8px",
            borderRadius: 999,
            border: "1px solid var(--line)",
            color: disabled ? "var(--ink-3)" : "var(--signal)",
            background: disabled ? "var(--paper-2)" : "transparent",
          }}
        >
          {disabled ? "데모 준비 중" : "상담 가능"}
        </span>
      </div>
      <span style={{ fontSize: 16, fontWeight: 540, letterSpacing: "-0.2px" }}>{company.name}</span>
      <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{company.industry}</span>
    </button>
  );
}
