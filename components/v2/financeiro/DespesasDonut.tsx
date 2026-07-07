'use client';

import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { DespCategoria } from './types';

// paleta: bordô → bronze → taupe → rosé → mauve (tons da marca, sem gradiente)
const TONS = ['#9A3B3B', '#A98953', '#B9AEA2', '#D8B4BE', '#8C5A6B', '#7C6F63', '#C9A24B'];

export default function DespesasDonut({ categorias, total }: { categorias: DespCategoria[]; total: number }) {
  const temDado = categorias.length > 0 && total > 0;
  return (
    <Card>
      <CardHead title="Despesas por categoria" right={<span className="nb-eyebrow">{brl(total)}</span>} action={{ label: 'Ver detalhamento', href: '/v2/financeiro' }} />
      {!temDado ? (
        <EmptyState icon="ChartPie" h={200} titulo="Nenhuma despesa neste mês." texto="A divisão por categoria aparece quando houver despesas lançadas no período." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 18, alignItems: 'center' }} className="v2-donut-row">
          <div style={{ position: 'relative', width: 150, height: 150 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={categorias} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius={52} outerRadius={72} paddingAngle={2} stroke="none">
                  {categorias.map((_, i) => <Cell key={i} fill={TONS[i % TONS.length]} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
              <div>
                <div style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)', letterSpacing: '.06em' }}>TOTAL</div>
                <div className="nb-num" style={{ fontSize: 15, fontWeight: 680, color: 'var(--nb-ink)' }}>{brl(total)}</div>
              </div>
            </div>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
            {categorias.map((r, i) => (
              <li key={r.nome} style={{ display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 10, alignItems: 'center', fontSize: 13 }}>
                <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: TONS[i % TONS.length] }} />
                <span style={{ color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span>
                <span className="nb-num" style={{ color: 'var(--nb-ink)', fontWeight: 560 }}>{brl(r.valor)}</span>
                <span className="nb-num" style={{ color: 'var(--nb-ink-faint)', minWidth: 42, textAlign: 'right' }}>{r.pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
