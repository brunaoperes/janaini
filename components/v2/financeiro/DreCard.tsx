'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { DreMes } from './types';

/** Linha do DRE. `neg` pinta em bordô; `forte` destaca; `divisor`/`total` marcam somatórios. */
function Linha({ rotulo, valor, forte, sub, neg, divisor }: { rotulo: string; valor: number; forte?: boolean; sub?: boolean; neg?: boolean; divisor?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '7px 0', paddingLeft: sub ? 16 : 0, borderTop: divisor ? '1px solid var(--nb-rule-soft)' : 'none', marginTop: divisor ? 4 : 0 }}>
      <span style={{ color: forte ? 'var(--nb-ink)' : sub ? 'var(--nb-ink-faint)' : 'var(--nb-ink-soft)', fontWeight: forte ? 640 : 400, fontSize: sub ? 13 : 14 }}>{rotulo}</span>
      <span className="nb-num" style={{ color: forte ? 'var(--nb-ink)' : neg ? 'var(--nb-bad)' : 'var(--nb-ink-soft)', fontWeight: forte ? 660 : 440, fontSize: sub ? 13 : 14, whiteSpace: 'nowrap' }}>{brl(valor)}</span>
    </div>
  );
}

export default function DreCard({ dre, mesLabel }: { dre: DreMes | null; mesLabel: string }) {
  const lucro = dre?.lucro ?? 0;
  const temReceita = (dre?.receitaBruta ?? 0) > 0 || (dre?.despesasTotal ?? 0) > 0;
  return (
    <Card>
      <CardHead title="DRE do mês" right={<span className="nb-eyebrow">{mesLabel}</span>} />
      {!dre || !temReceita ? (
        <EmptyState icon="ScrollText" h={280} titulo="Sem movimento neste mês." texto="O demonstrativo de resultado aparece assim que houver faturamento ou despesas lançadas." acao={{ label: 'Ver lançamentos', href: '/v2/lancamentos' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <Linha rotulo="Receita bruta (faturamento)" valor={dre.receitaBruta} />
          <Linha rotulo="(−) Impostos" valor={-dre.impostos} neg sub />
          {/* Receita líquida — destaque */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '10px 12px', margin: '6px 0', borderRadius: 10, background: 'var(--nb-accent-wash)' }}>
            <span style={{ fontWeight: 640, color: 'var(--nb-accent-deep)', fontSize: 14 }}>(=) Receita líquida</span>
            <span className="nb-num" style={{ fontWeight: 680, color: 'var(--nb-accent-deep)', fontSize: 16 }}>{brl(dre.receitaLiquida)}</span>
          </div>
          <Linha rotulo="(−) Comissões das profissionais" valor={-dre.comissoes} neg />
          <Linha rotulo="(−) Taxas de cartão" valor={-dre.taxasCartao} neg />
          <Linha rotulo="(−) Despesas fixas" valor={-dre.despesasFixas} neg />
          <Linha rotulo="(−) Despesas variáveis" valor={-dre.despesasVariaveis} neg />
          {/* Lucro — linha final forte */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: '2px solid var(--nb-rule)', marginTop: 8, paddingTop: 14 }}>
            <span style={{ fontWeight: 700, color: 'var(--nb-ink)', fontSize: 15 }}>{lucro >= 0 ? '(=) Lucro do mês' : '(=) Prejuízo do mês'}</span>
            <span className="nb-num" style={{ fontSize: 22, fontWeight: 720, letterSpacing: '-.01em', color: lucro >= 0 ? 'var(--nb-ok)' : 'var(--nb-bad)' }}>{brl(lucro)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 12, color: 'var(--nb-ink-faint)' }}>
            <span>Margem sobre receita líquida</span>
            <span className="nb-num" style={{ color: lucro >= 0 ? 'var(--nb-ok)' : 'var(--nb-bad)', fontWeight: 560 }}>{dre.margem.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
          </div>
        </div>
      )}
    </Card>
  );
}
