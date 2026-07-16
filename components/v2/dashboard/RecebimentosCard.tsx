'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl, num, pct } from '@/lib/v2/formatters';
import { EmptyState, type DashResp } from './_shared';

const TONS = ['#8C5A6B', '#A98953', '#6E4453', '#B9AEA2', '#5E6B4C', '#D8B4BE'];

export default function RecebimentosCard({ recebimentos }: { recebimentos: DashResp['recebimentos'] }) {
  const total = recebimentos.reduce((s, r) => s + r.valor, 0);
  const max = Math.max(1, ...recebimentos.map((r) => r.valor));

  return (
    <Card>
      <CardHead title="Recebimentos por forma" action={{ label: 'Ver detalhes', href: '/v2/relatorios' }} />
      {recebimentos.length === 0 ? (
        <EmptyState icon="ChartPie" titulo="Sem recebimentos no período." texto="As formas de pagamento aparecem aqui assim que houver caixa." />
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
            <span className="nb-eyebrow" style={{ fontSize: 10 }}>Total recebido</span>
            <span className="nb-num" style={{ fontSize: 18, fontWeight: 680, color: 'var(--nb-ink)' }}>{brl(total)}</span>
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {recebimentos.map((r, i) => (
              <li key={r.forma}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span aria-hidden style={{ width: 9, height: 9, borderRadius: 3, background: TONS[i % TONS.length], flex: '0 0 auto' }} />
                    <span style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  </span>
                  <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 640, color: 'var(--nb-ink)', flex: '0 0 auto' }}>{brl(r.valor)}</span>
                </div>
                <div className="v2-track"><span style={{ width: `${Math.max(3, (r.valor / max) * 100)}%`, background: TONS[i % TONS.length] }} /></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 5, fontSize: 11, color: 'var(--nb-ink-faint)' }} className="nb-num">
                  <span>{pct(r.pct, { casas: 1 })}</span>
                  <span>{num(r.transacoes)} {r.transacoes === 1 ? 'transação' : 'transações'}</span>
                  {r.taxa > 0 && <span>taxa {brl(r.taxa)}</span>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
