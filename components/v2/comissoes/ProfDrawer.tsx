'use client';

import { useEffect, useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { brl, num } from '@/lib/v2/formatters';
import { Avatar, SitBadge, LocalIcon } from './_shared';
import { formaLabel } from './types';
import type { DetalheResp, Range, Profissional } from './types';

const dCurta = (iso: string) => { const [a, m, d] = (iso || '').split('-'); return d ? `${d}/${m}/${a.slice(2)}` : '—'; };
const dHora = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

export default function ProfDrawer({ colaboradorId, periodo, onClose, onPagar }: {
  colaboradorId: number | null;
  periodo: Range;
  onClose: () => void;
  onPagar: (p: Profissional) => void;
}) {
  const [d, setD] = useState<DetalheResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState<'atendimentos' | 'historico'>('atendimentos');

  useEffect(() => {
    if (colaboradorId == null) { setD(null); setErro(''); setAba('atendimentos'); return; }
    let vivo = true; setLoading(true); setErro('');
    (async () => {
      try {
        const qs = `detalhe=${colaboradorId}&periodo=custom&de=${periodo.de}&ate=${periodo.ate}`;
        const r = await fetch(`/api/v2/comissoes?${qs}`, { cache: 'no-store' });
        const j = await r.json();
        if (!vivo) return;
        if (r.ok) setD(j); else setErro(j.error || 'Não foi possível carregar.');
      } catch { if (vivo) setErro('Erro de conexão.'); }
      finally { if (vivo) setLoading(false); }
    })();
    return () => { vivo = false; };
  }, [colaboradorId, periodo.de, periodo.ate]);

  useEffect(() => {
    if (colaboradorId == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [colaboradorId, onClose]);

  const aberto = colaboradorId != null;
  const R = d?.resumo;

  const pagarDaqui = () => {
    if (!d) return;
    onPagar({
      colaborador_id: d.profissional.colaborador_id, nome: d.profissional.nome, funcao: d.profissional.funcao,
      porcentagem_comissao: d.profissional.porcentagem_comissao, atendimentos: d.resumo.atendimentos,
      faturamento: d.resumo.faturamento, comissaoTotal: d.resumo.comissaoTotal, taxa: d.resumo.taxas,
      jaPago: d.resumo.jaPago, saldo: d.resumo.saldo, situacao: d.resumo.situacao, pendIds: d.pendIds,
    });
  };

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(33,28,25,.36)', backdropFilter: 'blur(2px)', opacity: aberto ? 1 : 0, pointerEvents: aberto ? 'auto' : 'none', transition: 'opacity .22s' }} />
      <aside role="dialog" aria-modal="true" aria-label="Detalhe da comissão" style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 71, width: 'min(480px, 96vw)',
        background: 'var(--nb-surface)', borderLeft: '1px solid var(--nb-rule)', boxShadow: '-12px 0 40px -20px rgba(33,28,25,.4)',
        transform: aberto ? 'none' : 'translateX(102%)', transition: 'transform .28s cubic-bezier(.22,1,.36,1)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          {d ? <Avatar nome={d.profissional.nome} size={42} /> : <span style={{ width: 42 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Comissão · {periodo.label}</div>
            <div style={{ fontSize: 17, fontWeight: 640, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d?.profissional.nome || 'Detalhe'}</div>
            {d?.profissional.funcao && <div style={{ fontSize: 12, color: 'var(--nb-ink-faint)' }}>{d.profissional.funcao}</div>}
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {loading && <div style={{ color: 'var(--nb-ink-faint)', textAlign: 'center', padding: 40 }}>Carregando…</div>}
          {erro && !loading && <div style={{ color: 'var(--nb-bad)', padding: 12 }}>{erro}</div>}

          {d && !loading && R && (
            <>
              {/* resumo financeiro */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <SitBadge s={R.situacao} />
                <span style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>{num(R.atendimentos)} atendimento{R.atendimentos === 1 ? '' : 's'}</span>
              </div>
              <div style={{ background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: 14, marginBottom: 16 }}>
                <Linha label="Faturamento gerado">{brl(R.faturamento)}</Linha>
                <Linha label="Comissão a pagar (líquida)">{brl(R.comissaoTotal)}</Linha>
                <Linha label="Taxas de cartão (custo do salão)" tone="var(--nb-ink-soft)">{R.taxas ? brl(R.taxas) : '—'}</Linha>
                <Linha label="Já pago" tone="var(--nb-ok)">{brl(R.jaPago)}</Linha>
                <div style={{ borderTop: '1px solid var(--nb-rule)', marginTop: 6, paddingTop: 6 }}>
                  <Linha label="Saldo pendente" tone="var(--nb-accent-deep)" strong>{brl(R.saldo)}</Linha>
                </div>
              </div>

              {R.saldo > 0.005 && (
                <Button icon="HandCoins" onClick={pagarDaqui} className="v2-com-cta" style={{ width: '100%', justifyContent: 'center', marginBottom: 16 }}>
                  Registrar pagamento · {brl(R.saldo)}
                </Button>
              )}

              {/* abas */}
              <div className="v2-seg" role="tablist" style={{ marginBottom: 12 }}>
                <button role="tab" aria-selected={aba === 'atendimentos'} className={aba === 'atendimentos' ? 'is-on' : ''} onClick={() => setAba('atendimentos')}>Atendimentos</button>
                <button role="tab" aria-selected={aba === 'historico'} className={aba === 'historico' ? 'is-on' : ''} onClick={() => setAba('historico')}>Histórico ({d.historico.length})</button>
              </div>

              {aba === 'atendimentos' ? (
                d.linhas.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--nb-ink-faint)', textAlign: 'center', padding: '20px 0' }}>Nenhum atendimento no período.</p>
                ) : (
                  <div style={{ border: '1px solid var(--nb-rule)', borderRadius: 12, overflow: 'hidden' }}>
                    {d.linhas.map((l, i) => (
                      <div key={`${l.id}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: i < d.linhas.length - 1 ? '1px solid var(--nb-rule-soft)' : undefined }}>
                        <span aria-hidden style={{ color: l.pago ? 'var(--nb-ok)' : 'var(--nb-ink-faint)' }}><Icon name={l.pago ? 'CircleCheck' : 'Clock'} size={16} /></span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13, color: 'var(--nb-ink)' }}>
                            {dCurta(l.data)}
                            {l.tipo === 'fiado' && <span className="nb-badge nb-warn" style={{ marginLeft: 6, fontSize: 10 }}>Fiado pago</span>}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>{l.pago ? 'Pago' : 'Pendente'} · atend. #{l.id}</span>
                        </span>
                        <span style={{ textAlign: 'right' }}>
                          <span className="nb-num" style={{ display: 'block', fontSize: 13, fontWeight: 620, color: 'var(--nb-ink)' }}>{brl(l.comissao)}</span>
                          <span className="nb-num" style={{ fontSize: 11, color: 'var(--nb-ink-faint)' }}>de {brl(l.valor)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                d.historico.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '20px 0', textAlign: 'center' }}>
                    <span aria-hidden style={{ color: 'var(--nb-ink-faint)' }}><LocalIcon name="history" size={24} /></span>
                    <p style={{ fontSize: 13, color: 'var(--nb-ink-faint)', margin: 0 }}>Nenhum pagamento registrado para esta profissional.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {d.historico.map((h) => (
                      <div key={h.id} style={{ border: '1px solid var(--nb-rule)', borderRadius: 12, padding: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                          <span className="nb-num" style={{ fontSize: 15, fontWeight: 680, color: 'var(--nb-ok)' }}>{brl(h.valor)}</span>
                          <span className="nb-badge nb-info" style={{ fontSize: 10.5 }}>{formaLabel(h.forma)}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', marginTop: 4 }}>
                          Pago em {dHora(h.pago_em)} · {h.qtd} atend. · ref. {dCurta(h.periodo_inicio)}–{dCurta(h.periodo_fim)}
                        </div>
                        {h.observacoes && <div style={{ fontSize: 12, color: 'var(--nb-ink-soft)', marginTop: 6 }}>{h.observacoes}</div>}
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function Linha({ label, children, tone, strong }: { label: string; children: React.ReactNode; tone?: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 16, padding: '7px 0' }}>
      <span style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: strong ? 17 : 14, fontWeight: strong ? 700 : 560, color: tone || 'var(--nb-ink)', textAlign: 'right' }}>{children}</span>
    </div>
  );
}
