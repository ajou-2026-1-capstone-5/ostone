import { useEffect, useRef, type CSSProperties, type RefObject } from "react";

export type WorkflowSettingValue = string | number;

export interface WorkflowSettingOption {
  value: WorkflowSettingValue;
  label: string;
}

export interface WorkflowSettingEntry {
  key: string;
  label: string;
  value: WorkflowSettingValue;
  options: ReadonlyArray<WorkflowSettingOption>;
  onChange: (next: WorkflowSettingValue) => void;
}

interface WorkflowSettingsPanelProps {
  entries: ReadonlyArray<WorkflowSettingEntry>;
  testId?: string;
  /** When provided the panel positions itself absolutely and listens for outside clicks. */
  style?: CSSProperties;
  onClickOutside?: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
}

const popoverStyle: CSSProperties = {
  position: "absolute",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-2)",
  padding: "var(--s-3)",
  background: "var(--paper)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r-2)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
  zIndex: 40,
  minWidth: "260px",
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "var(--s-2)",
  fontFamily: "var(--font-sans)",
  fontSize: "13px",
  fontWeight: 500,
  color: "var(--ink)",
  whiteSpace: "nowrap",
};

const labelStyle: CSSProperties = {
  flex: "0 0 auto",
  minWidth: "76px",
  letterSpacing: "-0.1px",
};

const chipsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "4px",
};

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: "999px",
    border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
    background: active ? "var(--ink)" : "var(--paper)",
    color: active ? "var(--paper)" : "var(--ink)",
    fontSize: "12px",
    fontWeight: 500,
    fontFamily: "var(--font-sans)",
    cursor: "pointer",
    lineHeight: 1.2,
  };
}

export function WorkflowSettingsPanel({
  entries,
  testId,
  style,
  onClickOutside,
  anchorRef,
}: WorkflowSettingsPanelProps) {
  const panelRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!onClickOutside) return;
    const handlePointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClickOutside();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClickOutside();
    };
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClickOutside, anchorRef]);

  const finalStyle: CSSProperties = { ...popoverStyle, ...style };

  return (
    <dialog
      ref={panelRef}
      open
      data-testid={testId ?? "workflow-settings-panel"}
      style={{ ...finalStyle, margin: 0 }}
    >
      {entries.map((entry) => (
        <div
          key={entry.key}
          style={rowStyle}
          data-testid={`${testId ?? "workflow-settings-panel"}-${entry.key}`}
        >
          <span style={labelStyle}>{entry.label}</span>
          <div style={chipsStyle}>
            {entry.options.map((opt) => {
              const active = opt.value === entry.value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => entry.onChange(opt.value)}
                  style={chipStyle(active)}
                  data-active={active ? "true" : "false"}
                  data-testid={`${testId ?? "workflow-settings-panel"}-${entry.key}-${opt.value}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </dialog>
  );
}
