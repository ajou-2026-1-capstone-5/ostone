import { Eyebrow } from "@/shared/ui/ostone/atoms";

interface HourBar {
  hour: number;
  status: "success" | "failure" | "none";
}

function generateBars(hours: number): HourBar[] {
  const bars: HourBar[] = [];
  for (let h = 0; h < hours; h++) {
    if (h === 7 || h === 19) {
      bars.push({ hour: h, status: "failure" });
    } else if ((h % 5 === 0 || h % 3 === 0) && h !== 0) {
      bars.push({ hour: h, status: "success" });
    } else if (h >= hours - 3) {
      bars.push({ hour: h, status: h === hours - 1 ? "none" : "success" });
    } else {
      bars.push({ hour: h, status: "none" });
    }
  }

  let successCount = bars.filter((b) => b.status === "success").length;
  let failureCount = bars.filter((b) => b.status === "failure").length;
  let noneCount = bars.filter((b) => b.status === "none").length;

  for (let i = 0; i < bars.length; i++) {
    if (successCount >= 15 && failureCount >= 2 && noneCount >= 7) break;
    if (bars[i].status === "none" && successCount < 15) {
      bars[i].status = "success";
      successCount++;
      noneCount--;
    } else if (bars[i].status === "none" && failureCount < 2) {
      bars[i].status = "failure";
      failureCount++;
      noneCount--;
    }
  }

  return bars;
}

export function RunHistoryStrip({ hours = 24 }: { hours?: number }) {
  const bars = generateBars(hours);

  const last3h = bars.slice(-3);
  const success3h = last3h.filter((b) => b.status === "success").length;
  const pending3h = last3h.filter((b) => b.status === "none").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 24 }}>
        {bars.map((bar) => {
          const deterministicOffset = ((bar.hour * 7 + 13) % 9);
          const height =
            bar.status === "none"
              ? 8
              : 12 + deterministicOffset;

          const color =
            bar.status === "success"
              ? "var(--signal)"
              : bar.status === "failure"
                ? "var(--danger)"
                : "var(--paper-3)";

          return (
            <div
              key={bar.hour}
              style={{
                width: 8,
                height: `${Math.round(height)}px`,
                background: color,
                borderRadius: "var(--r-1)",
                flexShrink: 0,
              }}
            />
          );
        })}
      </div>

      <div style={{ display: "flex", marginTop: 4 }}>
        {[0, 6, 12, 18].map((h) => (
          <span
            key={h}
            style={{
              fontFamily: "var(--mono)",
              fontSize: 8,
              color: "var(--ink-3)",
              width: 8 * 6 + 2 * 5,
              textAlign: "left",
              flexShrink: 0,
            }}
          >
            {String(h).padStart(2, "0")}
          </span>
        ))}
      </div>

      <div style={{ marginTop: 6 }}>
        <Eyebrow>
          Last 3h: {success3h} success, {pending3h} pending
        </Eyebrow>
      </div>
    </div>
  );
}
