'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import { brl } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { ContaPagar } from './types';

function fmtVenc(iso: string | null) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ContasPagar({ contas, qtdPendente, loading }: { contas: ContaPagar[]; qtdPendente: number; loading?: boolean }) {
  return (
    <Card pad={false}>
      <div style={{ padding: '18px 20px 0' }}>
        <CardHead
          title="Contas a pagar do mês"
          right={<span className="nb-eyebrow">{qtdPendente > 0 ? `${qtdPendente} pendente${qtdPendente !== 1 ? 's' : ''}` : `${contas.length} lançamento${contas.length !== 1 ? 's' : ''}`}</span>}
          action={{ label: 'Ver todas', href: '/v2/financeiro' }}
        />
      </div>
      {!loading && contas.length === 0 ? (
        <div style={{ padding: '0 20px 20px' }}>
          <EmptyState icon="Check" h={160} titulo="Nenhuma conta neste mês." texto="Quando houver despesas ou contas fixas lançadas para o período, elas aparecem aqui." acao={{ label: 'Lançar despesa', href: '/v2/financeiro' }} />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: 640 }}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : (
                contas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 560 }}>{c.descricao}</td>
                    <td style={{ color: 'var(--nb-ink-soft)' }}>{c.categoria}</td>
                    <td className="nb-num" style={{ color: 'var(--nb-ink-soft)' }}>{fmtVenc(c.vencimento)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(c.valor)}</td>
                    <td><Badge status={c.situacao} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
