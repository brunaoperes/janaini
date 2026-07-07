'use client';

import { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { Segmented, EmptyState, Stat } from '@/components/v2/dashboard/_shared';
import type { EvolucaoMes } from './types';

type Visao = 'mensal' | 'trimestral' | 'anual';
const eixoY = (v: number) => (Math.abs(v) >= 1000 ? `${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}k` : `${v}`);
const TRIM = ['1º tri', '2º tri', '3º tri', '4º tri'];

export default function EvolucaoChart({ evolucao }: { evolucao: EvolucaoMes[] }) {
  const [visao, setVisao] = useState<Visao>('mensal');

  const rows = useMemo(() => {
    if (visao === 'mensal') {
      return evolucao.map((m) => ({ label: m.mesAbr, receitaLiquida: m.receitaLiquida, despesasTotal: m.despesasTotal, lucro: m.lucro }));
    }
    if (visao === 'trimestral') {
      const acc: Record<number, { receitaLiquida: number; despesasTotal: number; lucro: number }> = {};
      for (const m of evolucao) {
        const t = Math.floor((m.mesNum - 1) / 3);
        (acc[t] ||= { receitaLiquida: 0, despesasTotal: 0, lucro: 0 });
        acc[t].receitaLiquida += m.receitaLiquida; acc[t].despesasTotal += m.despesasTotal; acc[t].lucro += m.lucro;
      }
      return Object.entries(acc).map(([t, v]) => ({ label: TRIM[+t], ...v }));
    }
    // anual
    const tot = evolucao.reduce((a, m) => ({ receitaLiquida: a.receitaLiquida + m.receitaLiquida, despesasTotal: a.despesasTotal + m.despesasTotal, lucro: a.lucro + m.lucro }), { receitaLiquida: 0, despesasTotal: 0, lucro: 0 });
    return [{ label: 'Ano', ...tot }];
  }, [evolucao, visao]);

  const temDado = evolucao.some((m) => m.receitaLiquida > 0 || m.despesasTotal > 0);
  const totRec = evolucao.reduce((s, m) => s + m.receitaLiquida, 0);
  const totDesp = evolucao.reduce((s, m) => s + m.despesasTotal, 0);
  const totLucro = evolucao.reduce((s, m) => s + m.lucro, 0);

  return (
    <Card>
      <CardHead title="Evolução financeira" right={<Segmented value={visao} onChange={(v) => setVisao(v)} options={[['mensal', 'Mensal'], ['trimestral', 'Trimestral'], ['anual', 'Anual']] as const} />} />
      {!temDado ? (
        <EmptyState icon="ChartColumnIncreasing" h={240} titulo="Sem histórico financeiro no ano." texto="Receita líquida, despesas e lucro aparecem aqui conforme os meses forem movimentados." />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 14, marginBottom: 16 }}>
            <Stat label="Receita líq. (ano)" value={brl(totRec)} />
            <Stat label="Despesas (ano)" value={brl(totDesp)} tone="bad" />
            <Stat label="Lucro (ano)" value={brl(totLucro)} tone={totLucro >= 0 ? 'ok' : 'bad'} />
          </div>
          <div style={{ width: '100%', height: 250 }}>
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EFE8DD" />
                <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: '#9A9089' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={eixoY} tick={{ fontSize: 11, fill: '#9A9089' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip
                  formatter={(v: number, name) => [brl(v), name === 'receitaLiquida' ? 'Receita líquida' : name === 'despesasTotal' ? 'Despesas' : 'Lucro']}
                  labelStyle={{ color: '#211C19', fontWeight: 600, fontSize: 12 }}
                  contentStyle={{ border: '1px solid #E6DDD1', borderRadius: 10, boxShadow: '0 4px 16px rgba(33,28,25,.08)', fontSize: 12.5 }}
                  cursor={{ fill: 'rgba(140,90,107,.06)' }}
                />
                <Legend wrapperStyle={{ fontSize: 11.5 }} iconType="circle" iconSize={8} />
                <Bar name="Receita líquida" dataKey="receitaLiquida" fill="#8C5A6B" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Bar name="Despesas" dataKey="despesasTotal" fill="#9A3B3B" radius={[4, 4, 0, 0]} maxBarSize={38} />
                <Line name="Lucro" type="monotone" dataKey="lucro" stroke="#3F6B57" strokeWidth={2.5} dot={{ r: 3, fill: '#3F6B57', strokeWidth: 0 }} activeDot={{ r: 5 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </Card>
  );
}
