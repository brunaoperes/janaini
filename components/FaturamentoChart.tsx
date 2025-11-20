'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface FaturamentoChartProps {
  data: Array<{ data: string; valor: number }>;
}

export default function FaturamentoChart({ data }: FaturamentoChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="h-80 flex items-center justify-center text-gray-500">
        <p>Nenhum dado disponível para exibir</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="data"
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `R$ ${value.toFixed(0)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #e5e7eb',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          formatter={(value: any) => [`R$ ${Number(value).toFixed(2)}`, 'Faturamento']}
          labelStyle={{ color: '#6b7280', fontWeight: 'bold' }}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke="url(#colorGradient)"
          strokeWidth={3}
          dot={{ fill: '#a855f7', r: 4 }}
          activeDot={{ r: 6, fill: '#ec4899' }}
        />
        <defs>
          <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </LineChart>
    </ResponsiveContainer>
  );
}
