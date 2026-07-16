'use client';

import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import Portal from '@/components/v2/ui/Portal';
import { brl, num } from '@/lib/v2/formatters';
import { Avatar, SitBadge, partesData, type Situacao } from './_shared';
import PayIcon, { labelForma } from './PayIcon';
import PagamentoFiadoModal, { type FiadoTarget } from '@/components/v2/fiados/PagamentoFiadoModal';

type Detalhe = {
  lancamento: {
    id: number; data: string; hora_inicio: string | null; hora_fim: string | null;
    cliente_nome: string; cliente_telefone: string | null; colaborador_nome: string;
    servicos_nomes: string | null; valor_total: number;
    comissao_colaborador: number | null; comissao_salao: number | null; taxa_pagamento: number | null;
    forma_pagamento: string | null; status: string | null; is_fiado: boolean; is_troca_gratis: boolean;
    valor_referencia: number | null; observacoes: string | null; situacao: Situacao; saldo_fiado: number;
  };
  pagamentosFiado: { valor_pago: number; forma_pagamento: string; data_pagamento: string; observacoes: string | null }[];
  pagamentosMultiplos: { forma_pagamento: string; valor: number; taxa_percentual: number | null; ordem: number }[];
};

function Linha({ label, children, tone }: { label: string; children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '9px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: 14, fontWeight: 560, color: tone || 'var(--nb-ink)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}

export default function LancDrawer({ id, onClose, onEdit, onChanged }: { id: number | null; onClose: () => void; onEdit?: (id: number) => void; onChanged?: () => void }) {
  const [d, setD] = useState<Detalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [pagar, setPagar] = useState(false);

  const carregarDetalhe = useCallback(async (lancId: number, comSpinner = true) => {
    if (comSpinner) setLoading(true);
    setErro('');
    try {
      const r = await fetch(`/api/v2/lancamentos?detalhe=${lancId}`, { cache: 'no-store' });
      const j = await r.json();
      if (r.ok) setD(j); else setErro(j.error || 'Não foi possível carregar.');
    } catch { setErro('Erro de conexão.'); }
    finally { if (comSpinner) setLoading(false); }
  }, []);

  useEffect(() => {
    if (id == null) { setD(null); setErro(''); setPagar(false); return; }
    let vivo = true;
    setLoading(true); setErro('');
    (async () => {
      try {
        const r = await fetch(`/api/v2/lancamentos?detalhe=${id}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (r.ok) setD(j); else setErro(j.error || 'Não foi possível carregar.');
      } catch { if (vivo) setErro('Erro de conexão.'); }
      finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [id]);

  // esc para fechar
  useEffect(() => {
    if (id == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [id, onClose]);

  const aberto = id != null;
  const L = d?.lancamento;
  const dt = partesData(L?.data, L?.hora_inicio);

  return (
    <Portal>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(33,28,25,.36)', backdropFilter: 'blur(2px)',
        opacity: aberto ? 1 : 0, pointerEvents: aberto ? 'auto' : 'none', transition: 'opacity .22s',
      }} />
      <aside role="dialog" aria-modal="true" aria-label="Detalhe do lançamento" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 71, width: 'min(440px, 94vw)',
        background: 'var(--nb-surface)', borderLeft: '1px solid var(--nb-rule)', boxShadow: '-12px 0 40px -20px rgba(33,28,25,.4)',
        transform: aberto ? 'none' : 'translateX(102%)', transition: 'transform .28s cubic-bezier(.22,1,.36,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <div>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Lançamento</div>
            <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 19, color: 'var(--nb-ink)' }}>
              {L ? `#${L.id}` : 'Detalhe'}
            </div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {loading && <div style={{ color: 'var(--nb-ink-faint)', textAlign: 'center', padding: 40 }}>Carregando…</div>}
          {erro && !loading && <div style={{ color: 'var(--nb-bad)', padding: 12 }}>{erro}</div>}

          {L && !loading && (
            <>
              {/* cliente + profissional + situação */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <Avatar nome={L.colaborador_nome} size={40} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>{L.cliente_nome}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>com {L.colaborador_nome}</div>
                </div>
                <SitBadge s={L.situacao} />
              </div>

              {L.servicos_nomes && (
                <div style={{ background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: '10px 12px', marginBottom: 14, fontSize: 13.5, color: 'var(--nb-ink)' }}>
                  {L.servicos_nomes.split(/[,;]/).map((s, i) => (
                    <span key={i}>{i > 0 && <span style={{ color: 'var(--nb-ink-faint)', margin: '0 6px' }}>•</span>}{s.trim()}</span>
                  ))}
                </div>
              )}

              <Linha label="Data / hora">{dt.dia}{dt.hora ? ` · ${dt.hora}` : ''}</Linha>
              <Linha label="Valor bruto">{brl(L.valor_total)}</Linha>
              {L.is_troca_gratis && L.valor_referencia != null && (
                <Linha label="Valor de referência" tone="var(--nb-ink-soft)">{brl(L.valor_referencia)}</Linha>
              )}
              <Linha label="Comissão da profissional">{L.comissao_colaborador != null ? brl(L.comissao_colaborador) : '—'}</Linha>
              <Linha label="Taxa da maquininha" tone={L.taxa_pagamento ? 'var(--nb-bad)' : undefined}>
                {L.taxa_pagamento ? `− ${brl(L.taxa_pagamento)}` : '—'}
              </Linha>
              <Linha label="Ficou pro salão" tone="var(--nb-ok)">{L.comissao_salao != null ? brl(L.comissao_salao) : '—'}</Linha>
              <Linha label="Forma de pagamento">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nb-ink)' }}>
                  <PayIcon forma={L.forma_pagamento} size={16} /> {labelForma(L.forma_pagamento)}
                </span>
              </Linha>

              {/* multi-forma */}
              {d.pagamentosMultiplos.length > 1 && (
                <div style={{ marginTop: 14 }}>
                  <div className="nb-eyebrow" style={{ fontSize: 9.5, marginBottom: 8 }}>Pagamento dividido</div>
                  {d.pagamentosMultiplos.map((p, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '5px 0', color: 'var(--nb-ink-soft)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PayIcon forma={p.forma_pagamento} size={15} /> {labelForma(p.forma_pagamento)}</span>
                      <span className="nb-num" style={{ color: 'var(--nb-ink)' }}>{brl(p.valor)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* histórico de fiado */}
              {L.is_fiado && (
                <div style={{ marginTop: 16 }}>
                  <div className="nb-eyebrow" style={{ fontSize: 9.5, marginBottom: 8 }}>Histórico de pagamentos (fiado)</div>
                  {d.pagamentosFiado.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Nenhum pagamento registrado ainda.</div>
                  ) : d.pagamentosFiado.map((p, i) => {
                    const pd = partesData(p.data_pagamento);
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 0', borderBottom: '1px solid var(--nb-rule-soft)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--nb-ink-soft)' }}>
                          <PayIcon forma={p.forma_pagamento} size={15} /> {pd.dia}
                        </span>
                        <span className="nb-num" style={{ color: 'var(--nb-ok)', fontWeight: 560 }}>{brl(p.valor_pago)}</span>
                      </div>
                    );
                  })}
                  {L.saldo_fiado > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, padding: '8px 10px', background: 'var(--nb-warn-bg)', borderRadius: 10, fontSize: 13 }}>
                      <span style={{ color: 'var(--nb-warn)', fontWeight: 600 }}>Saldo em aberto</span>
                      <span className="nb-num" style={{ color: 'var(--nb-warn)', fontWeight: 680 }}>{brl(L.saldo_fiado)}</span>
                    </div>
                  )}
                </div>
              )}

              {L.observacoes && (
                <div style={{ marginTop: 16 }}>
                  <div className="nb-eyebrow" style={{ fontSize: 9.5, marginBottom: 6 }}>Observações</div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--nb-ink-soft)', lineHeight: 1.55 }}>{L.observacoes}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* ações (preparadas — a edição/registro reusa a produção quando disponível) */}
        {L && !loading && (
          <div style={{ borderTop: '1px solid var(--nb-rule)', padding: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {onEdit ? (
              <button onClick={() => onEdit(L.id)} className="nb-btn nb-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                <Icon name="Settings" size={15} /> Editar
              </button>
            ) : (
              <a href={`/lancamentos?editar=${L.id}`} className="nb-btn nb-btn-ghost" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', fontSize: 13 }}>
                <Icon name="Settings" size={15} /> Editar
              </a>
            )}
            {(L.situacao === 'fiado' || L.situacao === 'parcial') && L.saldo_fiado > 0 && (
              <button onClick={() => setPagar(true)} className="nb-btn nb-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 13 }}>
                <Icon name="HandCoins" size={15} /> Registrar pagamento
              </button>
            )}
          </div>
        )}
      </aside>

      {pagar && L && (
        <PagamentoFiadoModal
          fiado={{
            lancamentoId: L.id,
            clienteNome: L.cliente_nome,
            colaboradorNome: L.colaborador_nome,
            valorTotal: L.valor_total,
            jaPago: d!.pagamentosFiado.reduce((s, p) => s + (Number(p.valor_pago) || 0), 0),
            saldo: L.saldo_fiado,
            dataServico: L.data,
          }}
          onClose={() => setPagar(false)}
          onDone={() => { setPagar(false); carregarDetalhe(L.id, false); onChanged?.(); }}
        />
      )}
    </Portal>
  );
}
