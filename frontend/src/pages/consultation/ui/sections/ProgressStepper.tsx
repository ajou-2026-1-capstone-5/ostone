export type ProgressStepperState = "done" | "active" | "todo";

export interface ProgressStepperStep {
  label: string;
  value?: string;
  state: ProgressStepperState;
}

interface ProgressStepperProps {
  steps: ProgressStepperStep[];
}

const STEP_BG: Record<ProgressStepperState, string> = {
  done: "var(--signal-bg)",
  active: "var(--ink)",
  todo: "var(--paper-2)",
};

const STEP_BORDER: Record<ProgressStepperState, string> = {
  done: "var(--signal)",
  active: "var(--ink)",
  todo: "var(--line-2)",
};

const STEP_LABEL_COLOR: Record<ProgressStepperState, string> = {
  done: "var(--signal-ink)",
  active: "var(--paper)",
  todo: "var(--ink-3)",
};

const STEP_VALUE_COLOR: Record<ProgressStepperState, string> = {
  done: "var(--ink)",
  active: "var(--paper)",
  todo: "var(--ink-2)",
};

export function ProgressStepper({ steps }: ProgressStepperProps) {
  return (
    <ol
      data-testid="progress-stepper"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.max(steps.length, 1)}, minmax(0, 1fr))`,
        gap: 6,
        listStyle: "none",
        margin: 0,
        padding: 0,
      }}
    >
      {steps.map((step) => {
        const isActive = step.state === "active";
        return (
          <li
            key={step.label}
            data-state={step.state}
            aria-current={isActive ? "step" : undefined}
            style={{
              padding: "10px 10px",
              borderRadius: "var(--r-3)",
              background: STEP_BG[step.state],
              border: `1px solid ${STEP_BORDER[step.state]}`,
              transition: "background 160ms ease, color 160ms ease",
            }}
          >
            <div
              style={{
                fontFamily: "var(--mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: STEP_LABEL_COLOR[step.state],
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {step.label}
            </div>
            {step.value !== undefined && (
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: STEP_VALUE_COLOR[step.state],
                }}
              >
                {step.value}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
