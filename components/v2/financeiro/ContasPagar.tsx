'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import type { ContaPagar } from './types';

function fmtVenc(iso: string | null) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export default function ContasPagar({ contas, qtdPendente, loading, onNovaDespesa, onMarcarPago, marcandoId }: {
  contas: ContaPagar[];
  qtdPendente: number;
  loading?: boolean;
  onNovaDespesa?: () => void;
  onMarcarPago?: (c: ContaPagar) => void;
  marcandoId?: number | null;
}) {
  const podeAgir = !!onMarcarPago;
  const colSpan = podeAgir ? 6 : 5;

  return (
    <Card pad={false}>
      <div style={{ padding: '18px 20px 0' }}>
        <CardHead
          title="Contas a pagar do mês"
          right={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
              <span className="nb-eyebrow">{qtdPendente > 0 ? `${qtdPendente} pendente${qtdPendente !== 1 ? 's' : ''}` : `${contas.length} lançamento${contas.length !== 1 ? 's' : ''}`}</span>
              {onNovaDespesa && (
                <button className="nb-btn nb-btn-ghost" onClick={onNovaDespesa} style={{ fontSize: 12.5 }}>
                  <Icon name="Plus" size={15} /> Lançar despesa
                </button>
              )}
            </div>
          }
        />
      </div>
      {!loading && contas.length === 0 ? (
        <div style={{ padding: '0 20px 20px' }}>
          <EmptyState icon="Check" h={160} titulo="Nenhuma conta neste mês." texto="Quando houver despesas ou contas fixas lançadas para o período, elas aparecem aqui." acao={onNovaDespesa ? { label: 'Lançar despesa', onClick: onNovaDespesa } : undefined} />
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: podeAgir ? 720 : 640 }}>
            <thead>
              <tr>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Vencimento</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th>Situação</th>
                {podeAgir && <th style={{ textAlign: 'right' }}>Ação</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={colSpan} style={{ textAlign: 'center', padding: 32, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : (
                contas.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 560 }}>{c.descricao}</td>
                    <td style={{ color: 'var(--nb-ink-soft)' }}>{c.categoria}</td>
                    <td className="nb-num" style={{ color: 'var(--nb-ink-soft)' }}>{fmtVenc(c.vencimento)}</td>
                    <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(c.valor)}</td>
                    <td><Badge status={c.situacao} /></td>
                    {podeAgir && (
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c.situacao === 'pago' ? (
                          <span style={{ fontSize: 12, color: 'var(--nb-ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Icon name="CircleCheck" size={14} /> Pago
                          </span>
                        ) : (
                          <button className="nb-btn nb-btn-quiet" onClick={() => onMarcarPago?.(c)} disabled={marcandoId === c.id}
                            style={{ fontSize: 12, padding: '4px 10px' }}>
                            {marcandoId === c.id ? 'Salvando…' : <><Icon name="Check" size={14} /> Marcar pago</>}
                          </button>
                        )}
                      </td>
                    )}
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
