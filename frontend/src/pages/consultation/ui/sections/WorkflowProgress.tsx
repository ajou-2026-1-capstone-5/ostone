import { Eyebrow, Icon } from "@/shared/ui/ostone/atoms";

export interface WorkflowStep {
  id: string;
  label: string;
  status: "done" | "active" | "pending";
}

export function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Eyebrow>처리 단계</Eyebrow>
      </div>
      <div style={{ display: "flex", flexDirection: "column", position: "relative" }}>
        <div
          style={{
            position: "absolute",
            left: 5,
            top: 12,
            bottom: 12,
            width: 2,
            background: "var(--line)",
          }}
        />
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "6px 0",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                position: "relative",
                zIndex: 1,
                ...getDotStyle(step.status),
              }}
            >
              {step.status === "done" && (
                <span
                  style={{
                    color: "var(--paper)",
                    display: "inline-flex",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <Icon name="check" size={10} />
                </span>
              )}
              {step.status === "active" && (
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "var(--signal)",
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              )}
            </div>
            <span
              style={{
                fontSize: 12,
                color: step.status === "pending" ? "var(--ink-3)" : "var(--ink)",
                fontWeight: step.status === "active" ? 700 : 400,
              }}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDotStyle(status: WorkflowStep["status"]): React.CSSProperties {
  if (status === "done") return { background: "var(--signal)" };
  if (status === "active") return { background: "var(--paper)", border: "3px solid var(--signal)" };
  return { background: "var(--paper-2)", border: "1px solid var(--line)" };
}
