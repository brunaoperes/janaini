'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Badge from '@/components/v2/ui/Badge';
import Icon from '@/components/v2/ui/Icon';
import { brl, num } from '@/lib/v2/formatters';
import { NOME_FORMA } from '@/lib/v2/financial';

const ABAS = [
  { id: 'hoje', label: 'Hoje' },
  { id: 'pendentes', label: 'Pendentes' },
  { id: 'finalizados', label: 'Finalizados' },
  { id: 'futuros', label: 'Futuros' },
  { id: 'todos', label: 'Todos' },
];

function fmtData(iso?: string) {
  if (!iso) return '—';
  const d = iso.slice(0, 10).split('-');
  const h = /T(\d{2}:\d{2})/.exec(iso)?.[1];
  return `${d[2]}/${d[1]}` + (h ? ` · ${h}` : '');
}
const statusBadge = (l: any) =>
  l.is_troca_gratis ? 'troca' : l.is_fiado ? 'fiado' : l.status === 'concluido' ? 'concluido' : l.status === 'cancelado' ? 'cancelado' : 'pendente';

export default function LancamentosV2() {
  const [aba, setAba] = useState('hoje');
  const [colab, setColab] = useState('');
  const [forma, setForma] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const carregar = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ aba, page: String(page), limit: '30' });
    if (colab) q.set('colaborador_id', colab);
    if (forma) q.set('forma', forma);
    try {
      const r = await fetch(`/api/v2/lancamentos?${q}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setData(j);
    } catch { /* */ } finally { setLoading(false); }
  }, [aba, colab, forma, page]);
  useEffect(() => { carregar(); }, [carregar]);
  useEffect(() => { setPage(1); }, [aba, colab, forma]);

  const R = data?.resumo;
  const pg = data?.paginacao;
  const formas = Array.from(new Set((data?.itens || []).map((l: any) => l.forma_pagamento).filter(Boolean)));

  return (
    <PageShell title="Lançamentos" subtitle="O que entrou, o que falta receber e o que é de cada um">
      {/* resumo do recorte filtrado */}
      <div className="v2-kpis" style={{ marginBottom: 16 }}>
        <Resumo label="Entrou (realizado)" value={brl(R?.faturamentoRealizado ?? 0)} icon="Wallet" />
        <Resumo label="Comissão das profissionais" value={brl(R?.comissaoRealizada ?? 0)} icon="HandCoins" />
        <Resumo label="Taxas de cartão" value={brl(R?.taxasCartao ?? 0)} icon="CreditCard" />
        <Resumo label="Ficou pro salão" value={brl(R?.parteSalao ?? 0)} icon="Landmark" tone="ok" />
      </div>

      {/* abas + filtros */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ABAS.map((a) => (
            <button key={a.id} onClick={() => setAba(a.id)}
              className={`nb-btn ${aba === a.id ? 'nb-btn-primary' : 'nb-btn-ghost'}`} style={{ padding: '8px 14px' }}>{a.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={colab} onChange={(e) => setColab(e.target.value)} className="nb-input" style={{ width: 'auto' }}>
            <option value="">Todas as profissionais</option>
            {(data?.colaboradores || []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select value={forma} onChange={(e) => setForma(e.target.value)} className="nb-input" style={{ width: 'auto' }}>
            <option value="">Toda forma de pagamento</option>
            {formas.map((f: any) => <option key={f} value={f}>{NOME_FORMA[f] || f}</option>)}
          </select>
        </div>
      </div>

      {/* tabela */}
      <Card pad={false}>
        <div style={{ overflowX: 'auto' }}>
          <table className="nb-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Data</th><th>Cliente</th><th>Profissional</th><th>Serviços</th>
                <th style={{ textAlign: 'right' }}>Valor</th>
                <th style={{ textAlign: 'right' }}>Comissão</th>
                <th style={{ textAlign: 'right' }}>Taxa</th>
                <th style={{ textAlign: 'right' }}>Salão</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : (data?.itens || []).length === 0 ? (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>Nenhum lançamento neste filtro.</td></tr>
              ) : data.itens.map((l: any) => (
                <tr key={l.id}>
                  <td className="nb-num" style={{ whiteSpace: 'nowrap', color: 'var(--nb-ink-soft)' }}>{fmtData(l.data)}</td>
                  <td style={{ fontWeight: 560 }}>{l.cliente_nome}</td>
                  <td style={{ color: 'var(--nb-ink-soft)' }}>{l.colaborador_nome}</td>
                  <td style={{ color: 'var(--nb-ink-soft)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.servicos_nomes || ''}>{l.servicos_nomes || '—'}</td>
                  <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(l.valor_total)}</td>
                  <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{l.comissao_colaborador != null ? brl(l.comissao_colaborador) : '—'}</td>
                  <td className="nb-num" style={{ textAlign: 'right', color: l.taxa_pagamento ? 'var(--nb-bad)' : 'var(--nb-ink-faint)' }}>{l.taxa_pagamento ? `−${brl(l.taxa_pagamento)}` : '—'}</td>
                  <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ok)', fontWeight: 560 }}>{l.comissao_salao != null ? brl(l.comissao_salao) : '—'}</td>
                  <td><Badge status={statusBadge(l)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* paginação (servidor) */}
        {pg && pg.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--nb-rule)', fontSize: 13, color: 'var(--nb-ink-soft)' }}>
            <span>{num(pg.total)} lançamento{pg.total !== 1 ? 's' : ''} · página {pg.page} de {pg.paginas || 1}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="nb-btn nb-btn-ghost" disabled={pg.page <= 1} onClick={() => setPage((n) => n - 1)} style={{ padding: '7px 12px' }}><Icon name="ChevronLeft" size={15} /> Anterior</button>
              <button className="nb-btn nb-btn-ghost" disabled={pg.page >= (pg.paginas || 1)} onClick={() => setPage((n) => n + 1)} style={{ padding: '7px 12px' }}>Próxima <Icon name="ChevronRight" size={15} /></button>
            </div>
          </div>
        )}
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 12 }}>
        <strong>Valor</strong> = bruto do atendimento · <strong>Comissão</strong> = da profissional (já sem a taxa) · <strong>Taxa</strong> = da maquininha · <strong>Salão</strong> = o que ficou pro salão. Filtro e paginação no servidor — sem teto de registros.
      </p>
    </PageShell>
  );
}

function Resumo({ label, value, icon, tone }: { label: string; value: string; icon: string; tone?: 'ok' }) {
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={icon} size={18} /></span>
      <div style={{ minWidth: 0 }}>
        <div className="nb-eyebrow" style={{ fontSize: 10 }}>{label}</div>
        <div className="nb-num" style={{ fontSize: 20, fontWeight: 680, color: tone === 'ok' ? 'var(--nb-ok)' : 'var(--nb-ink)', lineHeight: 1.1 }}>{value}</div>
      </div>
    </div>
  );
}
