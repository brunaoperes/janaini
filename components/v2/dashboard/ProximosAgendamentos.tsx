'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import { brl } from '@/lib/v2/formatters';
import { EmptyState, type DashResp } from './_shared';

export default function ProximosAgendamentos({ proximos }: { proximos: DashResp['proximos'] }) {
  const ultimos = proximos.modo === 'ultimos';
  const titulo = ultimos ? 'Últimos atendimentos' : 'Próximos agendamentos';
  const itens = proximos.itens;

  return (
    <Card>
      <CardHead title={titulo} action={{ label: 'Abrir agenda', href: '/v2/agenda' }} />
      {itens.length === 0 ? (
        <EmptyState icon="CalendarClock"
          titulo={ultimos ? 'Nenhum atendimento concluído no período.' : 'Nenhum agendamento próximo.'}
          texto={ultimos ? 'Os atendimentos concluídos aparecem aqui.' : 'Novos agendamentos aparecem aqui automaticamente.'}
          acao={{ label: 'Abrir agenda', href: '/v2/agenda' }} />
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' }}>
          {itens.map((p, i) => (
            <li key={i} style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: i < itens.length - 1 ? '1px solid var(--nb-rule-soft)' : 'none' }}>
              <div style={{ textAlign: 'left' }}>
                <span className="nb-num" style={{ display: 'block', fontSize: 13.5, fontWeight: 680, color: 'var(--nb-accent-deep)' }}>{p.hora || '—'}</span>
                {p.data && <span className="nb-num" style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)' }}>{p.data}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente || 'Cliente'}</span>
                <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[p.servico, p.colaboradora].filter(Boolean).join(' · ') || '—'}
                </span>
              </div>
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                {p.valor > 0 && <span className="nb-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-ink)' }}>{brl(p.valor)}</span>}
                <Badge status={p.status}>{undefined}</Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
