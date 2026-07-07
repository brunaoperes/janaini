'use client';

/** Sparkline discreta em SVG inline (sem dependência). Renderiza só quando há movimento real. */
export default function Sparkline({ values, color = 'var(--nb-accent)', height = 34 }: { values: number[]; color?: string; height?: number }) {
  const total = values.reduce((s, v) => s + v, 0);
  if (!values.length || total <= 0) return null;

  const W = 100, H = height, pad = 3;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (n - 1));
  const y = (v: number) => H - pad - ((v - min) / span) * (H - pad * 2);

  const pts = values.map((v, i) => `${x(i).toFixed(2)},${y(v).toFixed(2)}`);
  const line = `M ${pts.join(' L ')}`;
  const area = `${line} L ${x(n - 1).toFixed(2)},${H} L ${x(0).toFixed(2)},${H} Z`;
  const gid = `sk-${Math.random().toString(36).slice(2, 8)}`;
  const lastI = values.reduce((best, v, i) => (v >= values[best] ? i : best), 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" width="100%" height={H} aria-hidden style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(lastI)} cy={y(values[lastI])} r={1.9} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
