'use client';

import KpiCard from '@/components/v2/dashboard/KpiCard';
import { brl } from '@/lib/v2/formatters';
import type { FinanceiroResp } from './types';

const pctFmt = (v: number | null | undefined) => `${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

export default function KpisFinanceiro({ kpis, mesAnteriorLabel }: { kpis: FinanceiroResp['kpis']; mesAnteriorLabel: string }) {
  const antLabel = `vs ${mesAnteriorLabel}`;
  return (
    <div className="v2-fin-kpis">
      <KpiCard label="Receita bruta" icon="Wallet" value={brl(kpis.receitaBruta.value)} delta={kpis.receitaBruta.delta} anterior={kpis.receitaBruta.anterior} anteriorLabel={antLabel} />
      <KpiCard label="Receita líquida" icon="Landmark" value={brl(kpis.receitaLiquida.value)} delta={kpis.receitaLiquida.delta} anterior={kpis.receitaLiquida.anterior} anteriorLabel={antLabel} />
      <KpiCard label={kpis.lucro.value >= 0 ? 'Lucro do mês' : 'Prejuízo do mês'} icon="TrendingUp" value={brl(kpis.lucro.value)} tone={kpis.lucro.value >= 0 ? 'ok' : 'default'} delta={kpis.lucro.delta} anterior={kpis.lucro.anterior} anteriorLabel={antLabel} />
      <KpiCard label="Margem líquida" icon="Percent" value={pctFmt(kpis.margem.value)} delta={kpis.margem.delta} anterior={kpis.margem.anterior} anteriorLabel={antLabel} fmtDelta={pctFmt} />
      <KpiCard label="A pagar no mês" icon="Clock" value={brl(kpis.aPagar.value)} tone={kpis.aPagar.atrasado > 0 ? 'warn' : 'default'} delta={kpis.aPagar.delta} anterior={kpis.aPagar.anterior} anteriorLabel={antLabel}>
        {kpis.aPagar.atrasado > 0 && <span style={{ fontSize: 11.5, color: 'var(--nb-bad)', fontWeight: 560 }}>{brl(kpis.aPagar.atrasado)} em atraso</span>}
      </KpiCard>
      <KpiCard label="Saldo de caixa" icon="Coins" value={brl(kpis.saldoCaixa.value)} tone={kpis.saldoCaixa.value >= 0 ? 'default' : 'warn'} delta={kpis.saldoCaixa.delta} anterior={kpis.saldoCaixa.anterior} anteriorLabel={antLabel} />
    </div>
  );
}
