'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { brl } from '@/lib/v2/formatters';
import type { EvolucaoMes } from './types';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const rotulo = (mes: string) => { const [a, m] = mes.split('-'); return `${MESES[Number(m) - 1]}/${a.slice(2)}`; };

export default function EvolucaoChart({ data }: { data: EvolucaoMes[] }) {
  const rows = data.map((d) => ({ label: rotulo(d.mes), aPagar: d.aPagar, pago: d.pago }));
  const vazio = rows.every((r) => r.aPagar === 0 && r.pago === 0);

  if (vazio) {
    return <div style={{ height: 244, display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)', fontSize: 13 }}>Sem histórico de comissões nos últimos 6 meses.</div>;
  }

  return (
    <div style={{ width: '100%', height: 260 }}>
      <ResponsiveContainer>
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={4}>
          <CartesianGrid vertical={false} stroke="#EFE8DD" />
          <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={8} />
          <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${v}`)}
            tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            cursor={{ fill: 'rgba(140,90,107,.06)' }}
            formatter={(v: number, name) => [brl(v), name === 'aPagar' ? 'A pagar (líquida)' : 'Paga (líquida)']}
            labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
            contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
          />
          <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 6 }}
            formatter={(v) => (v === 'aPagar' ? 'Comissão a pagar' : 'Comissão paga')} />
          <Bar dataKey="aPagar" fill="#8C5A6B" radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="pago" fill="#3F6B57" radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
