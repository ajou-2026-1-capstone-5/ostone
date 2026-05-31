import type { FormEvent } from "react";

interface ChatEntryScreenProps {
  draftName: string;
  nameError: string | null;
  workspaceId: number;
  onDraftChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function ChatEntryScreen({
  draftName,
  nameError,
  workspaceId,
  onDraftChange,
  onSubmit,
}: ChatEntryScreenProps) {
  return (
    <div
      data-testid="chat-entry-screen"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 20px",
        background: "var(--paper-2)",
        color: "var(--ink)",
      }}
    >
      <form
        onSubmit={onSubmit}
        aria-label="채팅 사용자 이름 입력"
        data-testid="chat-entry-form"
        style={{
          width: "100%",
          maxWidth: 880,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--line)",
          background: "var(--paper)",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04), 0 18px 36px rgba(15, 23, 42, 0.06)",
        }}
      >
        <aside
          data-testid="chat-entry-brand"
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "32px 28px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                color: "var(--dark-ink-2)",
              }}
            >
              CSTONE · 고객 채팅 미리보기
            </div>
            <p
              style={{
                fontFamily: "var(--serif)",
                fontSize: 26,
                fontWeight: 400,
                fontStyle: "italic",
                lineHeight: 1.25,
                letterSpacing: "-0.5px",
                marginTop: 10,
                color: "var(--paper)",
              }}
            >
              운영 중인 도메인 팩으로
              <br />
              고객 화면을 미리 확인합니다.
              <br />
              먼저 테스트 고객 이름을 알려 주세요.
            </p>
            <p
              style={{
                marginTop: 18,
                fontSize: 12.5,
                lineHeight: 1.6,
                color: "var(--dark-ink-2)",
              }}
            >
              같은 이름으로 다시 들어오면 저장된 테스트 세션을 이어서 엽니다. 대화 화면에서
              새 테스트 세션을 시작할 수 있습니다.
            </p>
            <div
              style={{
                marginTop: 22,
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {["환불 요청", "배송 문의", "결제 오류"].map((chip) => (
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
                    background: "rgba(255, 255, 255, 0.08)",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    color: "var(--paper)",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 999,
                      background: "var(--signal)",
                    }}
                  />
                  {chip}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--dark-ink-3)",
            }}
          >
            PREVIEW · CURRENT PACK · Workspace #{workspaceId}
          </div>
        </aside>

        <div
          style={{
            padding: "36px 32px",
            background: "var(--paper)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 18,
          }}
        >
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--ink-3)",
            }}
          >
            Customer preview
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 540,
              letterSpacing: "-0.5px",
              color: "var(--ink)",
            }}
          >
            고객 채팅 미리보기
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.6,
              color: "var(--ink-2)",
            }}
          >
            운영 중인 도메인 팩이 고객에게 어떻게 응답하는지 확인할 이름을 적어 주세요.
            한글 / 영문 모두 가능합니다.
          </p>

          <div>
            <label
              htmlFor="chat-customer-name"
              style={{
                display: "block",
                fontFamily: "var(--mono)",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--ink-3)",
                marginBottom: 6,
              }}
            >
              이름
            </label>
            <input
              id="chat-customer-name"
              data-testid="chat-name-input"
              value={draftName}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="예: 김민지"
              autoComplete="name"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "chat-name-error" : undefined}
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
                id="chat-name-error"
                role="alert"
                data-testid="chat-name-error"
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: "var(--danger)",
                }}
              >
                {nameError}
              </p>
            )}
          </div>

          <button
            type="submit"
            data-testid="chat-entry-submit"
            style={{
              height: 48,
              padding: "0 18px",
              borderRadius: 999,
              border: "none",
              background: "var(--ink)",
              color: "var(--paper)",
              fontSize: 14,
              fontWeight: 540,
              letterSpacing: "-0.1px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            미리보기 시작
          </button>
          <div
            style={{
              fontFamily: "var(--mono)",
              fontSize: 10.5,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
            }}
          >
            ENTER 키로도 시작 가능
          </div>
        </div>
      </form>
    </div>
  );
}
