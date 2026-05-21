export interface EvalRun {
  id: string;
  label: string;
  k1: number;
  mappingRate: number;
  separability: number;
}

const DEFAULT_RUNS: EvalRun[] = [
  { id: "run-1", label: "run-1", k1: 0.72, mappingRate: 0.65, separability: 0.78 },
  { id: "run-2", label: "run-2", k1: 0.78, mappingRate: 0.71, separability: 0.82 },
  { id: "run-3", label: "run-3", k1: 0.83, mappingRate: 0.74, separability: 0.85 },
  { id: "run-4", label: "run-4", k1: 0.88, mappingRate: 0.79, separability: 0.89 },
  { id: "run-5", label: "run-5", k1: 0.92, mappingRate: 0.82, separability: 0.91 },
];

export function EvalChart({ runs, threshold = 0.6 }: { runs: EvalRun[]; threshold?: number }) {
  const data = runs.length > 0 ? runs : DEFAULT_RUNS;
  const viewW = 200;
  const viewH = 80;
  const padLeft = 24;
  const padRight = 8;
  const padTop = 4;
  const padBottom = 14;
  const chartW = viewW - padLeft - padRight;
  const chartH = viewH - padTop - padBottom;

  const xFor = (i: number) => padLeft + (i / (data.length - 1)) * chartW;
  const yFor = (v: number) => padTop + (1 - v) * chartH;

  function makePath(values: number[]) {
    return values.map((v, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(v)}`).join(" ");
  }

  const k1Path = makePath(data.map((d) => d.k1));
  const mrPath = makePath(data.map((d) => d.mappingRate));
  const sepPath = makePath(data.map((d) => d.separability));

  const thresholdY = yFor(threshold);

  const gridLines = [0, 0.5, 1].map((v) => ({
    y: yFor(v),
    label: v.toFixed(1),
  }));

  return (
    <div>
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label="Evaluation chart"
      >
        {gridLines.map((g) => (
          <g key={g.label}>
            <line
              x1={padLeft}
              y1={g.y}
              x2={viewW - padRight}
              y2={g.y}
              stroke="var(--line-2)"
              strokeWidth={0.5}
            />
            <text
              x={padLeft - 3}
              y={g.y + 2.5}
              textAnchor="end"
              style={{
                fontFamily: "var(--mono)",
                fontSize: 5,
                fill: "var(--ink-3)",
              }}
            >
              {g.label}
            </text>
          </g>
        ))}

        <line
          x1={padLeft}
          y1={thresholdY}
          x2={viewW - padRight}
          y2={thresholdY}
          stroke="var(--ink-3)"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <text
          x={viewW - padRight}
          y={thresholdY - 2}
          textAnchor="end"
          style={{
            fontFamily: "var(--mono)",
            fontSize: 4.5,
            fill: "var(--ink-3)",
          }}
        >
          threshold {threshold.toFixed(2)}
        </text>

        <path d={k1Path} fill="none" stroke="var(--signal)" strokeWidth={1} />
        <path d={mrPath} fill="none" stroke="var(--warn)" strokeWidth={1} />
        <path d={sepPath} fill="none" stroke="var(--info)" strokeWidth={1} />

        {data.map((d, i) => (
          <g key={d.id}>
            <circle cx={xFor(i)} cy={yFor(d.k1)} r={1.5} fill="var(--signal)" />
            <circle cx={xFor(i)} cy={yFor(d.mappingRate)} r={1.5} fill="var(--warn)" />
            <circle cx={xFor(i)} cy={yFor(d.separability)} r={1.5} fill="var(--info)" />
          </g>
        ))}

        {data.map((d, i) => (
          <text
            key={d.id}
            x={xFor(i)}
            y={viewH - 2}
            textAnchor="middle"
            style={{
              fontFamily: "var(--mono)",
              fontSize: 5,
              fill: "var(--ink-3)",
            }}
          >
            {d.label}
          </text>
        ))}
      </svg>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginTop: "6px",
          justifyContent: "center",
        }}
      >
        {[
          { color: "var(--signal)", label: "K@1" },
          { color: "var(--warn)", label: "mapping_rate" },
          { color: "var(--info)", label: "separability" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: item.color,
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontFamily: "var(--mono)",
                fontSize: 9,
                color: "var(--ink-2)",
              }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
