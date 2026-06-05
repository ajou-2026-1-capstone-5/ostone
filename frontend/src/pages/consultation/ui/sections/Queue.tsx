import { Avatar, Dot, Pill, Mono } from "@/shared/ui/ostone/atoms";
import { formatWaitDuration } from "@/features/consultation/lib/formatWaitDuration";

export interface QueueCustomer {
  id: string;
  name: string;
  channel: string;
  waitMinutes: number;
  preview: string;
  topic: string;
  urgent?: boolean;
}

export function Queue({
  items,
  activeId,
  onSelect,
}: {
  items: QueueCustomer[];
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div>
      {items.map((item) => {
        const isActive = item.id === activeId;
        const displayName = item.name?.trim() || "Unknown";
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect?.(item.id)}
            aria-current={isActive ? "true" : undefined}
            style={{
              display: "block",
              width: "100%",
              padding: "12px 14px 12px 16px",
              borderTop: 0,
              borderRight: 0,
              borderBottom: "1px solid var(--line)",
              borderLeft: isActive ? "3px solid var(--signal)" : "3px solid transparent",
              background: isActive ? "var(--paper-3)" : "transparent",
              color: "inherit",
              cursor: "pointer",
              font: "inherit",
              textAlign: "left",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Avatar initial={displayName.charAt(0)} size={28} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                {displayName}
              </span>
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>{item.channel}</Mono>
              <Mono style={{ fontSize: 10, color: "var(--ink-3)", marginLeft: "auto" }}>
                {formatWaitDuration(item.waitMinutes)}
              </Mono>
              {item.urgent && <Dot tone="signal" />}
            </div>
            <div
              style={{
                marginBottom: 6,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <Mono style={{ fontSize: 10, color: "var(--ink-3)" }}>“{item.preview}”</Mono>
            </div>
            <Pill tone="signal">{item.topic}</Pill>
          </button>
        );
      })}
    </div>
  );
}
