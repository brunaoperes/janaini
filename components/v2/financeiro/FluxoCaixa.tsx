'use client';

import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { FluxoCaixa as Fluxo } from './types';

function Stat({ label, value, cor }: { label: string; value: string; cor: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 'clamp(13px, 3.6vw, 19px)', fontWeight: 680, color: cor, lineHeight: 1.15 }}>{value}</div>
    </div>
  );
}

const eixoY = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k` : `${v}`);
const diaLabel = (iso: string) => iso.slice(8, 10);

export default function FluxoCaixaCard({ fluxo, mesLabel }: { fluxo: Fluxo | null; mesLabel: string }) {
  const temMov = !!fluxo && (fluxo.entrou > 0 || fluxo.saiu > 0);
  const rows = (fluxo?.dias || []).map((d) => ({ label: diaLabel(d.dia), entrou: d.entrou, saiu: d.saiu, saldo: d.saldo }));

  return (
    <Card>
      <CardHead title="Fluxo de caixa" right={<span className="nb-eyebrow">{mesLabel}</span>} />
      {!fluxo || !temMov ? (
        <EmptyState icon="Coins" h={280} titulo="Sem entradas ou saídas neste mês." texto="Entradas somam o que foi recebido; saídas, as despesas efetivamente pagas." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, padding: '2px 0 16px' }}>
            <Stat label="Entrou" value={brl(fluxo.entrou)} cor="var(--nb-ok)" />
            <Stat label="Saiu (pago)" value={brl(fluxo.saiu)} cor="var(--nb-bad)" />
            <Stat label="Saldo" value={brl(fluxo.saldo)} cor={fluxo.saldo >= 0 ? 'var(--nb-ink)' : 'var(--nb-bad)'} />
          </div>

          <div style={{ width: '100%', height: 210 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE8DD" />
                <XAxis dataKey="label" tick={{ fontSize: 10.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={6} interval="preserveStartEnd" minTickGap={12} />
                <YAxis tickFormatter={eixoY} tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={42} />
                <Tooltip
                  formatter={(v: number, name) => [brl(v), name === 'entrou' ? 'Entrou' : name === 'saiu' ? 'Saiu' : 'Saldo acum.']}
                  labelFormatter={(l) => `Dia ${l}`}
                  labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
                  contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
                  cursor={{ fill: 'rgba(140,90,107,.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="circle" iconSize={8} />
                <Bar name="Entrou" dataKey="entrou" fill="#3F6B57" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar name="Saiu" dataKey="saiu" fill="#9A3B3B" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Line name="Saldo" type="monotone" dataKey="saldo" stroke="#8C5A6B" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {fluxo.despesasAPagar > 0 && (
            <div style={{ padding: 12, borderRadius: 10, background: 'var(--nb-warn-bg, rgba(169,137,83,.10))', border: '1px solid #E7D4B4', fontSize: 12.5, color: 'var(--nb-warn)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
              <Icon name="Clock" size={16} /> Ainda há {brl(fluxo.despesasAPagar)} em contas não quitadas neste mês.
            </div>
          )}
          <p style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 12, marginBottom: 0 }}>
            Entradas = recebido no mês. Saídas = despesas efetivamente pagas (por data de pagamento).
          </p>
        </>
      )}
    </Card>
  );
}
