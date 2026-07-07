'use client';

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { diaMes, brl } from '@/lib/v2/formatters';

type Row = { dia: string; atual: number; anterior?: number };

export default function RevenueChart({ data }: { data: readonly Row[] }) {
  const rows = data.map((d) => ({ ...d, label: diaMes(d.dia) }));
  const temAnterior = data.some((d) => d.anterior != null && d.anterior > 0);
  return (
    <div style={{ width: '100%', height: 244 }}>
      <ResponsiveContainer>
        <LineChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#EFE8DD" strokeDasharray="0" />
          <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={8} />
          <YAxis tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${v}`)}
            tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={44} />
          <Tooltip
            formatter={(v: number, name) => [brl(v), name === 'atual' ? 'Período atual' : 'Período anterior']}
            labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
            contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
          />
          {temAnterior && <Line type="monotone" dataKey="anterior" stroke="#C9BCA9" strokeWidth={1.75} strokeDasharray="4 4" dot={false} />}
          <Line type="monotone" dataKey="atual" stroke="#8C5A6B" strokeWidth={2.5} dot={{ r: 3, fill: '#8C5A6B', strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
