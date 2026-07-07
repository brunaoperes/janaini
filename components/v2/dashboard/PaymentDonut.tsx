'use client';

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { brl } from '@/lib/v2/formatters';

type Row = { forma: string; valor: number; pct: number };
// tons da paleta: mauve profundo → bronze → taupe → rosé lavado
const TONS = ['#8C5A6B', '#A98953', '#B9AEA2', '#D8B4BE'];

export default function PaymentDonut({ data, total }: { data: readonly Row[]; total: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 18, alignItems: 'center' }}>
      <div style={{ position: 'relative', width: 150, height: 150 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data as Row[]} dataKey="valor" nameKey="forma" cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
              {data.map((_, i) => <Cell key={i} fill={TONS[i % TONS.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', letterSpacing: '.06em' }}>TOTAL</div>
            <div className="nb-num" style={{ fontSize: 16, fontWeight: 680, color: 'var(--nb-ink)' }}>{brl(total)}</div>
          </div>
        </div>
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {data.map((r, i) => (
          <li key={r.forma} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: TONS[i % TONS.length] }} />
            <span style={{ color: 'var(--nb-ink)' }}>{r.forma}</span>
            <span className="nb-num" style={{ color: 'var(--nb-ink)', fontWeight: 560 }}>{brl(r.valor)}</span>
            <span className="nb-num" style={{ color: 'var(--nb-ink-faint)', minWidth: 42, textAlign: 'right' }}>{r.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
