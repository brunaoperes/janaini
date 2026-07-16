'use client';

import { useEffect, useState, useCallback } from 'react';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl, num, iniciais } from '@/lib/v2/formatters';
import ClienteModal from '@/components/v2/clientes/ClienteModal';
import { getCache, setCache, invalidateCache } from '@/lib/v2/cache';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** aniversário salvo como 'YYYY-MM-DD' (ou 'MM-DD') -> '07/jul' */
function fmtAniversario(v?: string | null) {
  if (!v) return '—';
  const partes = v.slice(0, 10).split('-');
  const [d, m] = partes.length === 3 ? [partes[2], partes[1]] : [partes[1], partes[0]];
  const mi = Number(m) - 1;
  if (!d || mi < 0 || mi > 11) return '—';
  return `${d}/${MESES[mi]}`;
}

/** último atendimento: ISO -> 'dd/mm/aaaa' */
function fmtUltimo(iso?: string | null) {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

type Cliente = { id: number; nome: string; telefone: string; aniversario: string | null; atendimentos: number; totalGasto: number; ultimo: string | null };

export default function ClientesV2() {
  const [busca, setBusca] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ itens: Cliente[]; paginacao: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [modal, setModal] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | null>(null);

  // debounce simples da busca
  useEffect(() => {
    const t = setTimeout(() => setSearch(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);
  useEffect(() => { setPage(1); }, [search]);

  const carregar = useCallback(async () => {
    const q = new URLSearchParams({ page: String(page), limit: '30' });
    if (search) q.set('search', search);
    const url = `/api/v2/clientes?${q}`;
    const cached = getCache<{ itens: Cliente[]; paginacao: any }>(url);
    if (cached !== undefined) { setData(cached); setLoading(false); } // mostra na hora, sem "Carregando…"
    else setLoading(true);
    setErro(false);
    try {
      const r = await fetch(url, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) { setData(j); setCache(url, j); }
      else if (cached === undefined) setErro(true);
    } catch { if (cached === undefined) setErro(true); } finally { setLoading(false); }
  }, [page, search]);
  useEffect(() => { carregar(); }, [carregar]);

  const pg = data?.paginacao;
  const itens = data?.itens || [];

  return (
    <PageShell title="Clientes" subtitle="Cadastro, histórico e recorrência">
      {/* busca + novo cliente */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240, maxWidth: 420 }}>
          <span aria-hidden style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', display: 'grid', placeItems: 'center' }}><Icon name="Search" size={16} /></span>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="nb-input"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <button className="nb-btn nb-btn-primary" onClick={() => { setEditCliente(null); setModal(true); }}>
          <Icon name="UserPlus" size={16} /> Novo cliente
        </button>
      </div>

      {/* tabela */}
      <Card pad={false}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="nb-table" style={{ minWidth: 780 }}>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Telefone</th>
                <th>Aniversário</th>
                <th style={{ textAlign: 'right' }}>Atendimentos</th>
                <th style={{ textAlign: 'right' }}>Total gasto</th>
                <th>Último atendimento</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>Carregando…</td></tr>
              ) : erro ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-bad)' }}>Não foi possível carregar os clientes. <button className="nb-btn nb-btn-ghost" onClick={carregar} style={{ marginLeft: 8, padding: '6px 12px' }}>Tentar de novo</button></td></tr>
              ) : itens.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--nb-ink-faint)' }}>{search ? 'Nenhuma cliente encontrada nesta busca.' : 'Nenhuma cliente cadastrada ainda.'}</td></tr>
              ) : itens.map((c) => (
                <tr key={c.id} onClick={() => { setEditCliente(c); setModal(true); }} style={{ cursor: 'pointer' }} title="Editar cliente">
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
                      <span aria-hidden style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 600 }}>{iniciais(c.nome)}</span>
                      <span style={{ fontWeight: 560 }}>{c.nome}</span>
                    </span>
                  </td>
                  <td className="nb-num" style={{ whiteSpace: 'nowrap', color: 'var(--nb-ink-soft)' }}>{c.telefone || '—'}</td>
                  <td style={{ color: 'var(--nb-ink-soft)', whiteSpace: 'nowrap' }}>{fmtAniversario(c.aniversario)}</td>
                  <td className="nb-num" style={{ textAlign: 'right', color: 'var(--nb-ink-soft)' }}>{num(c.atendimentos)}</td>
                  <td className="nb-num" style={{ textAlign: 'right', fontWeight: 600 }}>{brl(c.totalGasto)}</td>
                  <td className="nb-num" style={{ whiteSpace: 'nowrap', color: 'var(--nb-ink-soft)' }}>{fmtUltimo(c.ultimo)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* paginação (servidor) */}
        {pg && pg.total > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, padding: '12px 16px', borderTop: '1px solid var(--nb-rule)', fontSize: 13, color: 'var(--nb-ink-soft)' }}>
            <span>{num(pg.total)} cliente{pg.total !== 1 ? 's' : ''} · página {pg.page} de {pg.paginas || 1}</span>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <button className="nb-btn nb-btn-ghost" disabled={pg.page <= 1} onClick={() => setPage((p) => p - 1)} style={{ padding: '7px 12px' }}><Icon name="ChevronLeft" size={15} /> Anterior</button>
              <button className="nb-btn nb-btn-ghost" disabled={pg.page >= (pg.paginas || 1)} onClick={() => setPage((p) => p + 1)} style={{ padding: '7px 12px' }}>Próxima <Icon name="ChevronRight" size={15} /></button>
            </div>
          </div>
        )}
      </Card>

      <p style={{ fontSize: 12, color: 'var(--nb-ink-faint)', marginTop: 12 }}>
        <strong>Total gasto</strong> e <strong>atendimentos</strong> contam apenas lançamentos concluídos, sem fiado e sem troca grátis. Busca e paginação no servidor.
      </p>

      {modal && (
        <ClienteModal
          cliente={editCliente}
          onClose={() => { setModal(false); setEditCliente(null); }}
          onSaved={() => { setModal(false); setEditCliente(null); invalidateCache('/api/v2/clientes'); setPage(1); carregar(); }}
        />
      )}
    </PageShell>
  );
}
