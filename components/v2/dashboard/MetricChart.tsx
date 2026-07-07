'use client';

import { useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl, num } from '@/lib/v2/formatters';
import { EmptyState, Segmented, Stat, fmtBucket, type DashResp, type Metric } from './_shared';

const METRICAS: readonly (readonly [Metric, string])[] = [
  ['faturamento', 'Faturamento'], ['caixa', 'Caixa'], ['comissao', 'Comissão'], ['liquido', 'Líquido'], ['agendamentos', 'Agendamentos'],
];
const ROTULO: Record<Metric, string> = { faturamento: 'Faturamento', caixa: 'Caixa', comissao: 'Comissão', liquido: 'Líquido', agendamentos: 'Agendamentos' };

export default function MetricChart({ serie, anteriorLabel }: { serie: DashResp['serie']; anteriorLabel: string }) {
  const [metric, setMetric] = useState<Metric>('faturamento');
  const gran = serie.granularidade;
  const ehMoeda = metric !== 'agendamentos';
  const fmt = ehMoeda ? brl : (v: number) => num(v);

  const rows = serie.buckets.map((b, i) => ({
    label: fmtBucket(b.k, gran),
    atual: b[metric],
    anterior: serie.anterior[i]?.[metric] ?? null,
  }));
  const temAlgum = serie.buckets.some((b) => b[metric] > 0) || serie.anterior.some((b) => b[metric] > 0);
  const temAnterior = serie.anterior.some((b) => (b?.[metric] ?? 0) > 0);
  const totalAtual = serie.buckets.reduce((s, b) => s + b[metric], 0);
  const totalAnt = serie.anterior.reduce((s, b) => s + b[metric], 0);
  const delta = totalAnt > 0 ? ((totalAtual - totalAnt) / totalAnt) * 100 : null;

  // melhor/pior por métrica selecionada (o resumo do contrato é por faturamento; recalculamos p/ a métrica ativa)
  let melhor = { label: '—', v: -Infinity }, pior = { label: '—', v: Infinity };
  serie.buckets.forEach((b) => {
    const v = b[metric];
    if (v > melhor.v) melhor = { label: fmtBucket(b.k, gran), v };
    if (v < pior.v) pior = { label: fmtBucket(b.k, gran), v };
  });

  const eixoY = (v: number) => ehMoeda
    ? (v >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : `${v}`)
    : `${v}`;

  return (
    <Card>
      <CardHead
        title="Evolução no período"
        right={<Segmented value={metric} onChange={setMetric} options={METRICAS} />}
      />

      {!temAlgum ? (
        <EmptyState icon="ChartColumnIncreasing" h={244}
          titulo="Nenhum dado financeiro encontrado para este período."
          texto="Ajuste os filtros ou registre um lançamento para ver a evolução aqui."
          acao={{ label: 'Ver / criar lançamento', href: '/v2/lancamentos' }} />
      ) : (
        <>
          <div style={{ width: '100%', height: 244 }}>
            <ResponsiveContainer>
              <LineChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE8DD" />
                <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={8} interval="preserveStartEnd" minTickGap={16} />
                <YAxis tickFormatter={eixoY} tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  formatter={(v: number, name) => [fmt(v), name === 'atual' ? 'Período atual' : 'Período anterior']}
                  labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
                  contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
                />
                {temAnterior && <Line type="monotone" dataKey="anterior" stroke="#C9BCA9" strokeWidth={1.75} strokeDasharray="4 4" dot={false} />}
                <Line type="monotone" dataKey="atual" stroke="#8C5A6B" strokeWidth={2.5} dot={{ r: 2.5, fill: '#8C5A6B', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 14, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--nb-rule-soft)' }}>
            <Stat label={`${ROTULO[metric]} · atual`} value={fmt(totalAtual)} />
            <Stat label="Período anterior" value={fmt(totalAnt)} tone="ink"
              hint={anteriorLabel} />
            <Stat label="Variação"
              value={delta == null ? '—' : `${delta > 0 ? '+' : ''}${Math.round(delta)}%`}
              tone={delta == null ? 'ink' : delta >= 0 ? 'ok' : 'bad'} />
            <Stat label="Melhor" value={melhor.v <= -Infinity ? '—' : fmt(melhor.v)} hint={melhor.label} />
            <Stat label="Pior" value={pior.v === Infinity ? '—' : fmt(pior.v)} hint={pior.label} />
          </div>
        </>
      )}
    </Card>
  );
}
