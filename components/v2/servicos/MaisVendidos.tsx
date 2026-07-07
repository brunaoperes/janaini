'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import { brl, num } from '@/lib/v2/formatters';
import { EmptyState } from '@/components/v2/dashboard/_shared';
import { CategoriaIcon, type ServResp } from './_shared';

export default function MaisVendidos({ itens, semHistorico, onSelect }: {
  itens: ServResp['maisVendidos'];
  semHistorico: boolean;
  onSelect?: (id: number) => void;
}) {
  const max = Math.max(1, ...itens.map((s) => s.receita));
  return (
    <Card>
      <CardHead title="Mais vendidos" />
      {itens.length === 0 ? (
        <EmptyState
          icon="Trophy"
          titulo={semHistorico ? 'Sem histórico suficiente' : 'Nenhuma venda registrada'}
          texto={semHistorico
            ? 'Ainda não há atendimentos concluídos para montar o ranking.'
            : 'Os serviços mais procurados aparecem aqui conforme os atendimentos.'}
        />
      ) : (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
          {itens.map((s, i) => (
            <li key={s.id ?? s.nome}>
              <button
                onClick={s.id != null && onSelect ? () => onSelect(s.id as number) : undefined}
                style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: s.id != null && onSelect ? 'pointer' : 'default', font: 'inherit' }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'baseline' }}>
                  <span className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden' }}>
                      <span style={{ color: 'var(--nb-accent)', display: 'inline-flex', flex: '0 0 auto' }}><CategoriaIcon cat={s.categoria} size={14} /></span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.nome}</span>
                    </span>
                    <span className="nb-num" style={{ display: 'block', fontSize: 11, color: 'var(--nb-ink-faint)', marginTop: 1 }}>
                      {num(s.quantidade)} {s.quantidade === 1 ? 'venda' : 'vendas'}
                    </span>
                  </span>
                  <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 640, color: 'var(--nb-ink)', textAlign: 'right' }}>{brl(s.receita)}</span>
                </div>
                <div className="v2-track" style={{ marginTop: 6 }}><span style={{ width: `${Math.max(4, (s.receita / max) * 100)}%`, background: i === 0 ? 'var(--nb-accent)' : 'var(--nb-gold)' }} /></div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
