'use client';

import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { EmptyState, Segmented, Stat, nomeMes, type DashResp } from './_shared';

type Serie = 'faturamento' | 'comissao' | 'liquido' | 'despesas' | 'lucro';
const OPCOES: readonly (readonly [Serie, string])[] = [
  ['faturamento', 'Faturamento'], ['comissao', 'Comissão'], ['liquido', 'Líquido'], ['despesas', 'Despesas'], ['lucro', 'Lucro'],
];
type MesAnual = NonNullable<DashResp['anual']>['meses'][number];
// líquido não vem por mês no contrato → derivamos (faturamento - comissao - taxas)
const valorMes = (m: MesAnual, s: Serie) =>
  s === 'liquido' ? m.faturamento - m.comissao - m.taxas : (m[s] as number);

export default function AnnualView({ anual }: { anual: NonNullable<DashResp['anual']> }) {
  const [serie, setSerie] = useState<Serie>('faturamento');
  const { meses, resumo } = anual;
  const temDado = meses.some((m) => m.faturamento > 0);

  const rows = meses.map((m) => ({ label: nomeMes(m.mes), v: valorMes(m, serie) }));
  const eixoY = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : `${v}`);
  const cor = serie === 'despesas' ? '#9A3B3B' : serie === 'lucro' ? '#3F6B57' : serie === 'comissao' ? '#A98953' : '#8C5A6B';

  return (
    <Card>
      <CardHead title="Visão anual" right={<Segmented value={serie} onChange={setSerie} options={OPCOES} />} />
      {!temDado ? (
        <EmptyState icon="ChartNoAxesColumn" h={220} titulo="Sem movimento registrado no ano." texto="Os meses aparecem aqui conforme houver lançamentos." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 14, marginBottom: 18 }}>
            <Stat label="Acumulado no ano" value={brl(resumo.faturamento)} />
            <Stat label="Média mensal" value={brl(resumo.mediaMensal)} />
            <Stat label="Melhor mês" value={resumo.melhorMes ? brl(resumo.melhorMes.valor) : '—'} hint={resumo.melhorMes ? nomeMes(resumo.melhorMes.mes) : undefined} tone="ok" />
            <Stat label="Pior mês" value={resumo.piorMes ? brl(resumo.piorMes.valor) : '—'} hint={resumo.piorMes ? nomeMes(resumo.piorMes.mes) : undefined} />
            <Stat label="Comissões" value={brl(resumo.comissao)} />
            <Stat label="Lucro" value={brl(resumo.lucro)} tone={resumo.lucro >= 0 ? 'ok' : 'bad'} />
            <Stat label="vs ano anterior"
              value={resumo.crescimentoVsAnoAnterior == null ? '—' : `${resumo.crescimentoVsAnoAnterior > 0 ? '+' : ''}${Math.round(resumo.crescimentoVsAnoAnterior)}%`}
              tone={resumo.crescimentoVsAnoAnterior == null ? 'ink' : resumo.crescimentoVsAnoAnterior >= 0 ? 'ok' : 'bad'} />
          </div>

          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE8DD" />
                <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={eixoY} tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v: number) => [brl(v), OPCOES.find(([s]) => s === serie)![1]]}
                  labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
                  contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
                  cursor={{ fill: 'rgba(140,90,107,.06)' }}
                />
                <Bar dataKey="v" fill={cor} radius={[5, 5, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ overflowX: 'auto', marginTop: 16 }}>
            <table className="nb-table">
              <thead>
                <tr>
                  <th>Mês</th><th style={{ textAlign: 'right' }}>Faturamento</th><th style={{ textAlign: 'right' }}>Comissão</th>
                  <th style={{ textAlign: 'right' }}>Despesas</th><th style={{ textAlign: 'right' }}>Lucro</th>
                  <th style={{ textAlign: 'right' }}>Atend.</th><th style={{ textAlign: 'right' }}>Ticket</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={String(m.mes)}>
                    <td style={{ fontWeight: 560 }}>{nomeMes(m.mes)}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{brl(m.faturamento)}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{brl(m.comissao)}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{brl(m.despesas)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', color: m.lucro >= 0 ? 'var(--nb-ok)' : 'var(--nb-bad)', fontWeight: 560 }}>{brl(m.lucro)}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{m.atendimentos}</td>
                    <td className="nb-num" style={{ textAlign: 'right' }}>{brl(m.ticket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
