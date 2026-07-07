'use client';

import { useMemo, useState } from 'react';
import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, iniciais } from '@/lib/v2/formatters';
import { EmptyState, Segmented, type DashResp } from './_shared';

type Ordem = 'faturamento' | 'comissao' | 'atendimentos' | 'ticket';
const OPCOES: readonly (readonly [Ordem, string])[] = [
  ['faturamento', 'Faturamento'], ['comissao', 'Comissão'], ['atendimentos', 'Atend.'], ['ticket', 'Ticket'],
];

export default function TopColaboradoras({ itens }: { itens: DashResp['topColaboradoras'] }) {
  const [ordem, setOrdem] = useState<Ordem>('faturamento');
  const ordenadas = useMemo(() => [...itens].sort((a, b) => (b[ordem] ?? 0) - (a[ordem] ?? 0)), [itens, ordem]);
  const max = Math.max(1, ...ordenadas.map((c) => c[ordem] ?? 0));
  const valorDe = (c: DashResp['topColaboradoras'][number]) =>
    ordem === 'atendimentos' ? num(c.atendimentos) : brl(c[ordem] as number);

  return (
    <Card>
      <CardHead title="Top colaboradoras" right={<Segmented value={ordem} onChange={setOrdem} options={OPCOES} />} />
      {ordenadas.length === 0 ? (
        <EmptyState icon="Users" titulo="Nenhum atendimento concluído no período." texto="O ranking aparece conforme os atendimentos forem concluídos." />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {ordenadas.map((c, i) => (
            <li key={c.id} style={{ display: 'grid', gridTemplateColumns: '16px 34px 1fr auto', gap: 11, alignItems: 'center' }}>
              <span className="nb-num" style={{ fontSize: 12, fontWeight: 700, color: i < 3 ? 'var(--nb-gold)' : 'var(--nb-ink-faint)' }}>{i + 1}</span>
              <span aria-hidden style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600 }}>{iniciais(c.nome)}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--nb-ink-faint)' }}>
                  {c.funcao || 'Colaboradora'} · {num(c.atendimentos)} atend. · ticket {brl(c.ticket)}
                </span>
                <span aria-hidden className="v2-track" style={{ marginTop: 5 }}><span style={{ width: `${Math.max(4, ((c[ordem] ?? 0) / max) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)' }} /></span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span className="nb-num" style={{ display: 'block', fontSize: 13.5, fontWeight: 640, color: 'var(--nb-ink)' }}>{valorDe(c)}</span>
                {c.delta != null && Math.abs(c.delta) >= 0.05 && (
                  <span className={`nb-delta ${c.delta > 0 ? 'nb-up' : 'nb-down'}`} style={{ fontSize: 11 }}>
                    <Icon name={c.delta > 0 ? 'TrendingUp' : 'TrendingDown'} size={12} />{c.delta > 0 ? '+' : ''}{Math.round(c.delta)}%
                  </span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
