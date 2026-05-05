interface SparkLineProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  className?: string;
}

interface SparkBarsProps {
  data: number[];
  w?: number;
  h?: number;
  color?: string;
  className?: string;
}

function computePoints(data: number[], w: number, h: number): string {
  if (data.length === 0) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max === min ? 1 : max - min;
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(' ');
}

export function SparkLine({ data, w = 60, h = 20, color = 'var(--signal)', className }: SparkLineProps) {
  if (data.length === 0) return null;
  const points = computePoints(data, w, h);
  const lastX = w;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max === min ? 1 : max - min;
  const lastY = h - ((data[data.length - 1] - min) / range) * h;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} xmlns="http://www.w3.org/2000/svg">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

export function SparkBars({ data, w = 60, h = 20, color = 'var(--signal)', className }: SparkBarsProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const barWidth = Math.max(1, w / data.length - 1);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className={className} xmlns="http://www.w3.org/2000/svg">
      {data.map((v, i) => {
        const barHeight = max === 0 ? 0 : (v / max) * h;
        const x = i * (w / data.length);
        const y = h - barHeight;
        return <rect key={i} x={x} y={y} width={barWidth} height={barHeight} rx={1} fill={color} />;
      })}
    </svg>
  );
}
