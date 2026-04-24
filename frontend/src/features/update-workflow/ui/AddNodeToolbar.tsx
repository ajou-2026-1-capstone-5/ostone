import type { GraphNodeType } from "@/entities/workflow";

const NODE_TYPES: GraphNodeType[] = [
  "START",
  "ACTION",
  "DECISION",
  "ANSWER",
  "HANDOFF",
  "TERMINAL",
];

interface AddNodeToolbarProps {
  onAddNode: (type: GraphNodeType) => void;
}

export function AddNodeToolbar({ onAddNode }: AddNodeToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        padding: "8px",
        borderBottom: "1px solid var(--text-primary, #000)",
        flexWrap: "wrap",
      }}
    >
      {NODE_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onAddNode(type)}
          style={{
            background: "transparent",
            border: "1px solid var(--text-primary, #000)",
            borderRadius: "50px",
            padding: "2px 10px",
            fontSize: "11px",
            fontFamily: "inherit",
            letterSpacing: "-0.1px",
            cursor: "pointer",
            color: "var(--text-primary, #000)",
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline =
              "dashed 2px var(--text-primary, #000)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.outline = "none";
          }}
        >
          + {type}
        </button>
      ))}
    </div>
  );
}
