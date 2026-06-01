import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { buildDemoChatPath } from "@/shared/lib/demoRoutes";
import { CompanyCard } from "./CompanyCard";
import {
  DEMO_COMPANIES,
  type DemoCompany,
  getDefaultDemoCompany,
} from "../model/demoCompanies";

const labelStyle = {
  fontFamily: "var(--mono)",
  fontSize: 10.5,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--ink-3)",
} as const;

export function DemoPage() {
  const navigate = useNavigate();
  const [activeCompany, setActiveCompany] = useState<DemoCompany>(
    getDefaultDemoCompany,
  );
  const [draftName, setDraftName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeCompany.enabled) {
      setNameError(
        "선택한 회사는 아직 데모를 준비 중입니다. 다른 회사를 선택해 주세요.",
      );
      return;
    }

    const name = draftName.trim();
    if (!name) {
      setNameError("이름을 입력해 주세요.");
      return;
    }

    setNameError(null);
    navigate(
      buildDemoChatPath(
        activeCompany.workspaceId,
        new URLSearchParams({ name }),
      ),
    );
  };

  return (
    <div
      data-testid="demo-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        background: "var(--paper-2)",
        color: "var(--ink)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          gap: 20,
        }}
      >
        <section
          aria-label="회사 선택"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <div style={labelStyle}>Step 1 · 회사 선택</div>
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 540,
              letterSpacing: "-0.4px",
            }}
          >
            상담할 회사를 선택하세요
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            카드를 클릭하거나 마우스를 올리면 회사 정보를 볼 수 있습니다.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 4,
            }}
          >
            {DEMO_COMPANIES.map((company) => (
              <CompanyCard
                key={company.workspaceId}
                company={company}
                active={company.workspaceId === activeCompany.workspaceId}
                onActivate={setActiveCompany}
              />
            ))}
          </div>
        </section>

        <section
          aria-label="회사 정보 및 이름 입력"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 18,
            padding: "28px 28px",
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--paper)",
            boxShadow:
              "0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 36px rgba(15, 23, 42, 0.06)",
          }}
        >
          <div
            data-testid="demo-company-info"
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div style={labelStyle}>{activeCompany.industry}</div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 540,
                letterSpacing: "-0.3px",
              }}
            >
              {activeCompany.name}
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.65,
                color: "var(--ink-2)",
              }}
            >
              {activeCompany.blurb}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {activeCompany.focusChips.map((chip) => (
                <span
                  key={chip}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontFamily: "var(--mono)",
                    fontSize: 10.5,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    border: "1px solid var(--line)",
                    color: "var(--ink-2)",
                  }}
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            aria-label="이름 입력"
            data-testid="demo-name-form"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              borderTop: "1px solid var(--line-2)",
              paddingTop: 18,
            }}
          >
            <div style={labelStyle}>Step 2 · 이름 입력</div>
            <label
              htmlFor="demo-customer-name"
              style={{ ...labelStyle, marginBottom: 0 }}
            >
              이름
            </label>
            <input
              id="demo-customer-name"
              data-testid="demo-name-input"
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder="예: 김민지"
              autoComplete="name"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "demo-name-error" : undefined}
              style={{
                width: "100%",
                height: 48,
                padding: "0 16px",
                borderRadius: 8,
                border: "1px solid var(--line)",
                background: "var(--paper)",
                color: "var(--ink)",
                fontSize: 14,
                fontWeight: 500,
                fontFamily: "inherit",
              }}
            />
            {nameError && (
              <p
                id="demo-name-error"
                role="alert"
                data-testid="demo-name-error"
                style={{ margin: 0, fontSize: 12, color: "var(--danger)" }}
              >
                {nameError}
              </p>
            )}
            <button
              type="submit"
              data-testid="demo-start-chat"
              disabled={!activeCompany.enabled}
              style={{
                height: 48,
                padding: "0 18px",
                borderRadius: 999,
                border: "none",
                background: activeCompany.enabled
                  ? "var(--ink)"
                  : "var(--ink-3)",
                color: "var(--paper)",
                fontSize: 14,
                fontWeight: 540,
                letterSpacing: "-0.1px",
                cursor: activeCompany.enabled ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {activeCompany.enabled ? "채팅 시작" : "데모 준비 중"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
