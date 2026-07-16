'use client';

import { useState } from 'react';
import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl } from '@/lib/v2/formatters';
import { Segmented, EmptyState } from '@/components/v2/dashboard/_shared';
import type { DreMatrizMes } from './types';

type Modo = 'reais' | 'pct';

// Linhas do DRE na ordem da matriz. `base` = usa receita líquida como denominador no modo %.
const LINHAS: { key: keyof DreMatrizMes; label: string; neg?: boolean; forte?: boolean; base?: boolean; margem?: boolean }[] = [
  { key: 'receitaBruta', label: 'Receita bruta', forte: true },
  { key: 'receitaLiquida', label: 'Receita líquida', forte: true, base: true },
  { key: 'comissoes', label: 'Comissões', neg: true },
  { key: 'taxasCartao', label: 'Taxas de cartão', neg: true },
  { key: 'despesasFixas', label: 'Despesas fixas', neg: true },
  { key: 'despesasVariaveis', label: 'Despesas variáveis', neg: true },
  { key: 'lucro', label: 'Lucro do mês', forte: true },
  { key: 'margem', label: 'Margem %', margem: true },
];

export default function DreMatriz({ matriz }: { matriz: DreMatrizMes[] }) {
  const [modo, setModo] = useState<Modo>('reais');
  const temDado = matriz.some((m) => m.receitaBruta > 0 || m.despesasTotal > 0);

  const fmt = (m: DreMatrizMes, l: (typeof LINHAS)[number]) => {
    const v = m[l.key] as number;
    if (l.margem) return `${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    if (modo === 'pct') {
      const base = m.receitaLiquida;
      if (!base) return '—';
      return `${((v / base) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    }
    return brl(v);
  };

  return (
    <Card pad={false}>
      <div style={{ padding: '18px 20px 0' }}>
        <CardHead
          title="DRE mês a mês"
          right={<Segmented value={modo} onChange={(v) => setModo(v)} options={[['reais', 'R$'], ['pct', '% da rec. líquida']] as const} />}
        />
      </div>
      {!temDado ? (
        <div style={{ padding: '0 20px 20px' }}>
          <EmptyState icon="ChartNoAxesColumn" h={180} titulo="Ainda não há meses com movimento." texto="A comparação mês a mês aparece conforme o faturamento for sendo registrado no ano." />
        </div>
      ) : (
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: 4 }}>
          <table className="nb-table" style={{ minWidth: 120 + matriz.length * 92 }}>
            <thead>
              <tr>
                <th style={{ position: 'sticky', left: 0, background: 'var(--nb-surface)', zIndex: 1 }}>Linha</th>
                {matriz.map((m) => (
                  <th key={m.mesNum} style={{ textAlign: 'right', color: m.selecionado ? 'var(--nb-accent-deep)' : undefined, background: m.selecionado ? 'var(--nb-accent-wash)' : undefined }}>
                    {m.mesAbr}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LINHAS.map((l) => (
                <tr key={String(l.key)} style={l.forte ? { background: 'var(--nb-surface-2)' } : undefined}>
                  <td style={{ position: 'sticky', left: 0, background: l.forte ? 'var(--nb-surface-2)' : 'var(--nb-surface)', zIndex: 1, fontWeight: l.forte ? 640 : 440, color: l.neg ? 'var(--nb-ink-soft)' : 'var(--nb-ink)', whiteSpace: 'nowrap' }}>
                    {l.label}
                  </td>
                  {matriz.map((m) => {
                    const isLucro = l.key === 'lucro';
                    const isMargem = l.margem;
                    const val = m[l.key] as number;
                    const cor = (isLucro || isMargem) ? (val >= 0 ? 'var(--nb-ok)' : 'var(--nb-bad)') : l.neg ? 'var(--nb-bad)' : 'var(--nb-ink)';
                    return (
                      <td key={m.mesNum} className="nb-num" style={{ textAlign: 'right', fontWeight: l.forte ? 600 : 440, color: cor, background: m.selecionado ? 'var(--nb-accent-wash)' : undefined, whiteSpace: 'nowrap' }}>
                        {fmt(m, l)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
