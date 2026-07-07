'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl, num, pct } from '@/lib/v2/formatters';
import { EmptyState, type DashResp } from './_shared';

export default function ServicosVendidos({ itens }: { itens: DashResp['servicosMaisVendidos'] }) {
  const max = Math.max(1, ...itens.map((s) => s.faturamento));
  return (
    <Card>
      <CardHead title="Serviços mais vendidos" action={{ label: 'Ver detalhes', href: '/v2/lancamentos' }} />
      {itens.length === 0 ? (
        <EmptyState icon="Scissors" titulo="Nenhum serviço vendido no período." texto="Os serviços mais procurados aparecem aqui conforme os atendimentos." />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {itens.map((s, i) => (
            <li key={s.nome}>
              <div style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto', gap: 10, alignItems: 'baseline' }}>
                <span className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{i + 1}</span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                  <span className="nb-num" style={{ display: 'block', fontSize: 11, color: 'var(--nb-ink-faint)' }}>
                    {num(s.quantidade)} {s.quantidade === 1 ? 'venda' : 'vendas'} · ticket {brl(s.ticket)} · {pct(s.pct, { casas: 1 })}
                  </span>
                </span>
                <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 640, color: 'var(--nb-ink)', textAlign: 'right' }}>{brl(s.faturamento)}</span>
              </div>
              <div className="v2-track" style={{ marginTop: 6 }}><span style={{ width: `${Math.max(4, (s.faturamento / max) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)' }} /></div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
