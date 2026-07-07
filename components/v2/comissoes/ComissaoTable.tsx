'use client';

import { useState, useMemo } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, pct } from '@/lib/v2/formatters';
import { Avatar, SitBadge, LocalIcon } from './_shared';
import type { Profissional, Totais } from './types';

type SortKey = 'nome' | 'atendimentos' | 'faturamento' | 'comissaoTotal' | 'jaPago' | 'saldo';

export default function ComissaoTable({
  profissionais, totais, loading, onVer, onPagar, onHistorico,
}: {
  profissionais: Profissional[];
  totais: Totais | null;
  loading: boolean;
  onVer: (id: number) => void;
  onPagar: (p: Profissional) => void;
  onHistorico: (id: number) => void;
}) {
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'saldo', dir: -1 });

  const rows = useMemo(() => {
    const arr = [...profissionais];
    arr.sort((a, b) => {
      const va = a[sort.k]; const vb = b[sort.k];
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb) * sort.dir;
      return (Number(va) - Number(vb)) * sort.dir;
    });
    return arr;
  }, [profissionais, sort]);

  const th = (k: SortKey, label: string, right = false) => (
    <th style={{ textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => setSort((s) => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: right ? 'flex-end' : 'flex-start' }}>
        {label}
        <Icon name={sort.k === k ? (sort.dir === 1 ? 'TrendingUp' : 'TrendingDown') : 'ArrowUpDown'} size={12} />
      </span>
    </th>
  );

  return (
    <>
      {/* Desktop / tablet: tabela */}
      <div className="v2-com-tablewrap" style={{ overflowX: 'auto' }}>
        <table className="nb-table" style={{ minWidth: 860 }}>
          <thead>
            <tr>
              {th('nome', 'Profissional')}
              <th style={{ textAlign: 'right' }}>Comissão %</th>
              {th('atendimentos', 'Atend.', true)}
              {th('faturamento', 'Faturamento gerado', true)}
              {th('comissaoTotal', 'Comissão a pagar', true)}
              {th('jaPago', 'Já pago', true)}
              {th('saldo', 'Saldo', true)}
              <th>Situação</th>
              <th style={{ textAlign: 'right' }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}><td colSpan={9} style={{ padding: 10 }}><div className="v2-skel" style={{ height: 20, borderRadius: 8 }} /></td></tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 36, color: 'var(--nb-ink-faint)' }}>Nenhuma comissão para os filtros selecionados.</td></tr>
            ) : rows.map((p) => (
              <tr key={p.colaborador_id} className="nb-row-hover">
                <td>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    <Avatar nome={p.nome} size={30} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontWeight: 560, color: 'var(--nb-ink)' }}>{p.nome}</span>
                      {p.funcao && <span style={{ display: 'block', fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{p.funcao}</span>}
                    </span>
                  </span>
                </td>
                <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{p.porcentagem_comissao ? pct(p.porcentagem_comissao, { casas: 0 }) : '—'}</td>
                <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{num(p.atendimentos)}</td>
                <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{brl(p.faturamento)}</td>
                <td className="nb-num" style={{ textAlign: 'right', fontWeight: 620, color: 'var(--nb-ink)' }}>{brl(p.comissaoTotal)}</td>
                <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ok)' }}>{p.jaPago > 0 ? brl(p.jaPago) : '—'}</td>
                <td className="nb-num" style={{ textAlign: 'right', fontWeight: 640, color: p.saldo > 0.005 ? 'var(--nb-accent-deep)' : 'var(--nb-ink-faint)' }}>{brl(p.saldo)}</td>
                <td><SitBadge s={p.situacao} /></td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 2, justifyContent: 'flex-end', width: '100%' }}>
                    <button className="nb-btn nb-btn-quiet" style={{ padding: 7 }} title="Ver detalhes" aria-label="Ver detalhes" onClick={() => onVer(p.colaborador_id)}><LocalIcon name="eye" size={16} /></button>
                    <button className="nb-btn nb-btn-quiet" style={{ padding: 7 }} title="Registrar pagamento" aria-label="Registrar pagamento" disabled={p.saldo <= 0.005} onClick={() => onPagar(p)}><Icon name="HandCoins" size={16} /></button>
                    <button className="nb-btn nb-btn-quiet" style={{ padding: 7 }} title="Histórico" aria-label="Histórico" onClick={() => onHistorico(p.colaborador_id)}><LocalIcon name="history" size={16} /></button>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          {!loading && rows.length > 0 && totais && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--nb-rule)' }}>
                <td style={{ fontWeight: 680, paddingTop: 12 }}>{num(totais.profissionais)} profissiona{totais.profissionais === 1 ? 'l' : 'is'}</td>
                <td />
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12 }}>{num(totais.atendimentos)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12 }}>{brl(totais.faturamento)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12, fontWeight: 700 }}>{brl(totais.comissaoTotal)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12, color: 'var(--nb-ok)' }}>{brl(totais.jaPago)}</td>
                <td className="nb-num" style={{ textAlign: 'right', paddingTop: 12, fontWeight: 700, color: 'var(--nb-accent-deep)' }}>{brl(totais.saldo)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="v2-com-cards" style={{ display: 'none', flexDirection: 'column', gap: 10 }}>
        {loading ? (
          [...Array(3)].map((_, i) => <div key={i} className="v2-skel" style={{ height: 92, borderRadius: 14 }} />)
        ) : rows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 28, color: 'var(--nb-ink-faint)' }}>Nenhuma comissão para os filtros selecionados.</div>
        ) : rows.map((p) => (
          <div key={p.colaborador_id} style={{ border: '1px solid var(--nb-rule)', borderRadius: 14, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Avatar nome={p.nome} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 620, color: 'var(--nb-ink)' }}>{p.nome}</div>
                <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{p.funcao || `${num(p.atendimentos)} atend.`}</div>
              </div>
              <SitBadge s={p.situacao} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 10 }}>
              <Mini label="A pagar" v={brl(p.comissaoTotal)} />
              <Mini label="Já pago" v={p.jaPago > 0 ? brl(p.jaPago) : '—'} tone="ok" />
              <Mini label="Saldo" v={brl(p.saldo)} tone="accent" />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nb-btn nb-btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={() => onVer(p.colaborador_id)}><LocalIcon name="eye" size={15} /> Detalhes</button>
              <button className="nb-btn nb-btn-primary" style={{ flex: 1, fontSize: 13 }} disabled={p.saldo <= 0.005} onClick={() => onPagar(p)}><Icon name="HandCoins" size={15} /> Pagar</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Mini({ label, v, tone }: { label: string; v: string; tone?: 'ok' | 'accent' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)';
  return (
    <div>
      <div className="nb-eyebrow" style={{ fontSize: 9 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 14, fontWeight: 640, color }}>{v}</div>
    </div>
  );
}
