export interface SparkPoint {
  value: number;
  date: string;
}

export interface SparkLineData {
  path: string;
  lastX: number;
  lastY: number;
  min: number;
  max: number;
}

export interface SparkBar {
  heightPct: number;
  isLast: boolean;
}

export interface SparkBarsData {
  bars: SparkBar[];
}

export type Tone = "signal" | "warn" | "danger" | "mute";

export interface StatCardData {
  label: string;
  value: string;
  delta: number;
  tone: Tone;
  sparkPoints?: SparkPoint[];
}

export interface EvalSeries {
  date: string;
  mappingRate: number;
  k1: number;
  outlierRate: number;
}

export interface NodeMetricData {
  label: string;
  value: string;
  trend: "up" | "down" | "flat";
  tone: Tone;
}

export interface FooterStatData {
  label: string;
  value: string;
  delta?: number;
  tone?: Tone;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function deriveSparkPoints(code: string, count = 7): SparkPoint[] {
  const points: SparkPoint[] = [];
  const hash = hashString(code);
  const baseDate = new Date("2025-01-01");

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i * 7);
    const dateStr = date.toISOString().split("T")[0];
    const value = ((hash >> (i * 3)) & 0xff) % 100;
    points.push({ value: Math.max(5, value), date: dateStr });
  }

  return points;
}

export function deriveTrendBars(code: string, count = 5): number[] {
  const hash = hashString(code);
  const bars: number[] = [];

  for (let i = 0; i < count; i++) {
    const value = ((hash >> (i * 4)) & 0xff) % 100;
    bars.push(Math.max(10, value));
  }

  return bars;
}

export function getSparkLinePoints(config: {
  points: SparkPoint[];
  width?: number;
  height?: number;
}): SparkLineData {
  const width = config.width ?? 84;
  const height = config.height ?? 18;
  const padding = 2;
  const points = config.points;

  if (points.length === 0) {
    return { path: "", lastX: 0, lastY: 0, min: 0, max: 0 };
  }

  if (points.length <= 1) {
    const single = points[0] || { value: 0 };
    const y = height / 2;
    return {
      path: "",
      lastX: width / 2,
      lastY: y,
      min: single.value,
      max: single.value,
    };
  }

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (points.length - 1);
  const pointsStr: string[] = [];

  points.forEach((point, i) => {
    const x = padding + i * stepX;
    const normalizedY = (point.value - min) / range;
    const y = height - padding - normalizedY * (height - padding * 2);
    pointsStr.push(`${x},${y.toFixed(2)}`);
  });

  const lastPoint = points[points.length - 1];
  const lastNormalizedY = (lastPoint.value - min) / range;
  const lastX = width - padding;
  const lastY = height - padding - lastNormalizedY * (height - padding * 2);

  return {
    path: pointsStr.join(" "),
    lastX,
    lastY,
    min,
    max,
  };
}

export function getSparkBars(config: {
  values: number[];
  width?: number;
  height?: number;
}): SparkBarsData {
  const values = config.values;

  if (values.length === 0) {
    return { bars: [] };
  }

  const max = Math.max(...values);
  const bars: SparkBar[] = values.map((value, i) => ({
    heightPct: max > 0 ? (value / max) * 100 : 0,
    isLast: i === values.length - 1,
  }));

  return { bars };
}

export const toneValues: Tone[] = ["signal", "warn", "danger", "mute"];

export function deriveWorkspaceStats(workspaceCode: string): StatCardData[] {
  const hash = hashString(workspaceCode);
  const sparkPoints = deriveSparkPoints(workspaceCode);

  return [
    {
      label: "Intents",
      value: String(((hash >> 8) & 0xff) % 50 + 5),
      delta: ((hash >> 16) & 0xff) % 30 - 10,
      tone: toneValues[(hash >> 24) & 3],
      sparkPoints,
    },
    {
      label: "Slots",
      value: String(((hash >> 10) & 0xff) % 30 + 2),
      delta: ((hash >> 18) & 0xff) % 20 - 5,
      tone: toneValues[(hash >> 26) & 3],
      sparkPoints: deriveSparkPoints(workspaceCode + "-slots"),
    },
    {
      label: "Workflows",
      value: String(((hash >> 12) & 0xff) % 20 + 1),
      delta: ((hash >> 20) & 0xff) % 15 - 3,
      tone: toneValues[(hash >> 28) & 3],
      sparkPoints: deriveSparkPoints(workspaceCode + "-workflows"),
    },
    {
      label: "Reviews",
      value: String(((hash >> 14) & 0xff) % 100 + 10),
      delta: ((hash >> 22) & 0xff) % 25 - 8,
      tone: toneValues[(hash >> 30) & 3],
    },
  ];
}

export function deriveEvalData(packCode: string): EvalSeries[] {
  const hash = hashString(packCode);
  const series: EvalSeries[] = [];
  const baseDate = new Date("2025-01-01");

  for (let i = 0; i < 8; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i * 14);
    const dateStr = date.toISOString().split("T")[0];

    const baseMapping = 70 + ((hash >> (i * 2)) & 0x3f);
    const mappingRate = Math.min(95, baseMapping);
    const k1 = 0.6 + ((hash >> (i * 3 + 8)) & 0x3f) / 100;
    const outlierRate = 5 + ((hash >> (i * 2 + 16)) & 0x1f);

    series.push({
      date: dateStr,
      mappingRate,
      k1: Math.min(0.95, k1),
      outlierRate: Math.min(25, outlierRate),
    });
  }

  return series;
}

export function deriveNodeMetrics(nodeId: string): NodeMetricData[] {
  const hash = hashString(nodeId);
  const trendValues: Array<"up" | "down" | "flat"> = ["up", "down", "flat"];
  const tone3Values: Tone[] = ["signal", "warn", "mute"];

  const metrics: NodeMetricData[] = [
    {
      label: "Match Rate",
      value: `${75 + ((hash >> 8) & 0x1f)}%`,
      trend: trendValues[(hash >> 16) % 3],
      tone: tone3Values[(hash >> 20) % 3],
    },
    {
      label: "Avg Latency",
      value: `${50 + ((hash >> 10) & 0x7f)}ms`,
      trend: trendValues[(hash >> 18) % 3],
      tone: toneValues[(hash >> 22) & 3],
    },
    {
      label: "Calls",
      value: String(100 + ((hash >> 12) & 0x3ff)),
      trend: trendValues[(hash >> 24) % 3],
      tone: "signal",
    },
  ];

  return metrics;
}

export function deriveFooterStats(packCode: string): FooterStatData[] {
  const hash = hashString(packCode);

  return [
    {
      label: "Total Intents",
      value: String(((hash >> 6) & 0xff) % 100 + 10),
      delta: ((hash >> 14) & 0xff) % 30 - 10,
      tone: ((hash >> 22) & 3) === 0 ? "signal" : "mute",
    },
    {
      label: "Active Slots",
      value: String(((hash >> 8) & 0xff) % 50 + 5),
      delta: ((hash >> 16) & 0xff) % 20 - 5,
      tone: ((hash >> 24) & 3) === 1 ? "warn" : "mute",
    },
    {
      label: "Version",
      value: `v${1 + ((hash >> 10) & 0xf)}.${((hash >> 14) & 0xf)}.${((hash >> 18) & 0xf)}`,
      tone: "signal",
    },
    {
      label: "Last Updated",
      value: `${2025 + ((hash >> 22) & 1)}-${String(1 + ((hash >> 23) % 12)).padStart(2, "0")}-${String(((hash >> 27) % 28) + 1).padStart(2, "0")}`,
    },
  ];
}
