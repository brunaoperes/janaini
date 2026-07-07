'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';
import { Avatar } from '@/components/v2/lancamentos/_shared';
import PagamentoFiadoModal, { type FiadoTarget } from '@/components/v2/fiados/PagamentoFiadoModal';

/* Card "Fiados em aberto" — atalho na /v2/financeiro. Lista os fiados pendentes
   (todos, não só do mês) e abre o mesmo PagamentoFiadoModal para receber.
   Reusa a API de produção GET/POST /api/fiados. */

type FiadoAPI = {
  id: number;
  valor_total: number;
  data: string;
  servicos_nomes?: string | null;
  cliente?: { nome?: string } | null;
  colaborador?: { nome?: string } | null;
};

const dCurta = (iso?: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a.slice(2)}`;
};

export default function FiadosAbertosCard({ onPago }: { onPago?: () => void }) {
  const [fiados, setFiados] = useState<FiadoAPI[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [alvo, setAlvo] = useState<FiadoTarget | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true); setErro('');
    try {
      const r = await fetch('/api/fiados?status=pendente', { cache: 'no-store' });
      const j = await r.json();
      if (!r.ok) { setErro(j.error || 'Não foi possível carregar os fiados.'); return; }
      setFiados(j.fiados || []);
      setTotal(j.totais?.pendente || 0);
    } catch { setErro('Erro de conexão.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 640, color: 'var(--nb-ink)' }}>Fiados em aberto</h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--nb-ink-faint)' }}>Recebimentos pendentes de clientes</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="nb-eyebrow" style={{ fontSize: 9 }}>Total a receber</div>
          <div className="nb-num" style={{ fontSize: 20, fontWeight: 700, color: 'var(--nb-warn)', letterSpacing: '-.01em' }}>{brl(total)}</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="v2-skel" style={{ height: 46, borderRadius: 10 }} />)}
        </div>
      ) : erro ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '20px 0', textAlign: 'center' }}>
          <span style={{ color: 'var(--nb-bad)', fontSize: 13 }}>{erro}</span>
          <button className="nb-btn nb-btn-ghost" onClick={carregar} style={{ fontSize: 12.5 }}><Icon name="RotateCcw" size={14} /> Tentar de novo</button>
        </div>
      ) : fiados.length === 0 ? (
        <div style={{ display: 'grid', placeItems: 'center', gap: 8, padding: '28px 0', textAlign: 'center' }}>
          <span aria-hidden style={{ width: 42, height: 42, borderRadius: 12, background: 'var(--nb-ok-bg)', color: 'var(--nb-ok)', display: 'grid', placeItems: 'center' }}><Icon name="CircleCheck" size={20} /></span>
          <div style={{ fontSize: 13.5, color: 'var(--nb-ink-soft)' }}>Nenhum fiado em aberto.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 320, overflowY: 'auto' }}>
          {fiados.map((f) => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 2px', borderBottom: '1px solid var(--nb-rule-soft)' }}>
              <Avatar nome={f.colaborador?.nome || f.cliente?.nome || '—'} size={30} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 560, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.cliente?.nome || 'Cliente'}</div>
                <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {dCurta(f.data)}{f.servicos_nomes ? ` · ${f.servicos_nomes}` : ''}
                </div>
              </div>
              <span className="nb-num" style={{ fontSize: 13.5, fontWeight: 620, color: 'var(--nb-ink)', whiteSpace: 'nowrap' }}>{brl(f.valor_total)}</span>
              <button
                className="nb-btn nb-btn-ghost"
                style={{ fontSize: 12.5, padding: '6px 10px' }}
                onClick={() => setAlvo({
                  lancamentoId: f.id,
                  clienteNome: f.cliente?.nome || 'Cliente',
                  colaboradorNome: f.colaborador?.nome || null,
                  valorTotal: f.valor_total,
                  jaPago: 0,
                  saldo: f.valor_total,
                  dataServico: f.data,
                })}
              >
                <Icon name="HandCoins" size={14} /> Receber
              </button>
            </div>
          ))}
        </div>
      )}

      {alvo && (
        <PagamentoFiadoModal
          fiado={alvo}
          onClose={() => setAlvo(null)}
          onDone={() => { setAlvo(null); carregar(); onPago?.(); }}
        />
      )}
    </Card>
  );
}
