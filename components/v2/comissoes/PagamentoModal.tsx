'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import { brl } from '@/lib/v2/formatters';
import { Avatar } from './_shared';
import type { Profissional, Range, DetalheResp, DetalheLinha } from './types';

const FORMAS: [string, string][] = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['transferencia', 'Transferência'], ['outro', 'Outro']];
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dCurta = (iso: string) => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a.slice(2)}`; };

export default function PagamentoModal({ prof, periodo, onClose, onDone }: {
  prof: Profissional;
  periodo: Range;
  onClose: () => void;
  onDone: () => void;
}) {
  const [linhas, setLinhas] = useState<DetalheLinha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [forma, setForma] = useState('pix');
  const [data, setData] = useState(hoje());
  const [obs, setObs] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const qs = `detalhe=${prof.colaborador_id}&periodo=custom&de=${periodo.de}&ate=${periodo.ate}`;
        const r = await fetch(`/api/v2/comissoes?${qs}`, { cache: 'no-store' });
        const j: DetalheResp = await r.json();
        if (!vivo) return;
        const pend = (j.linhas || []).filter((l) => !l.pago && l.id);
        setLinhas(pend);
        setSel(new Set(pend.map((l) => l.id)));
      } catch { if (vivo) toast.error('Erro ao carregar atendimentos.'); }
      finally { if (vivo) setCarregando(false); }
    })();
    return () => { vivo = false; };
  }, [prof.colaborador_id, periodo.de, periodo.ate]);

  const estePagamento = useMemo(() => Math.round(linhas.filter((l) => sel.has(l.id)).reduce((s, l) => s + l.comissao, 0) * 100) / 100, [linhas, sel]);
  const saldoApos = Math.round((prof.saldo - estePagamento) * 100) / 100;
  const parcial = sel.size < linhas.length;

  const toggle = (id: number) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function registrar() {
    if (sel.size === 0) { toast.error('Selecione ao menos um atendimento.'); return; }
    setSalvando(true);
    try {
      const observacoes = [obs.trim(), data !== hoje() ? `Referente ao pagamento de ${dCurta(data)}.` : ''].filter(Boolean).join(' ');
      const ids = linhas.filter((l) => sel.has(l.id)).map((l) => l.id);
      const r = await fetch('/api/comissoes/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: prof.colaborador_id,
          periodo_inicio: periodo.de,
          periodo_fim: periodo.ate,
          valor_liquido: estePagamento,
          forma_pagamento_comissao: forma,
          observacoes,
          lancamentos_ids: ids,
          detalhes_calculo: { origem: 'v2/comissoes', data_pagamento: data, periodo: { inicio: periodo.de, fim: periodo.ate }, selecionados: ids.length, total_pendente: linhas.length },
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'Não foi possível registrar o pagamento.'); return; }
      toast.success(`Pagamento de ${brl(j.pagamento?.valor_liquido ?? estePagamento)} registrado.`);
      onDone();
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  }

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="nb-card" style={{ width: '100%', maxWidth: 520, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <Avatar nome={prof.nome} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Registrar pagamento</div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)' }}>{prof.nome}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>Período {periodo.label}. Os valores são recalculados no servidor a partir dos atendimentos selecionados.</p>

          {/* resumo topo */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: 12 }}>
            <Resumo label="Comissão total" v={brl(prof.comissaoTotal)} />
            <Resumo label="Já pago" v={brl(prof.jaPago)} tone="ok" />
            <Resumo label="Saldo" v={brl(prof.saldo)} tone="accent" />
          </div>

          {!confirmar ? (
            <>
              {/* seleção de atendimentos */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="nb-eyebrow" style={{ fontSize: 10 }}>Atendimentos a pagar</span>
                  {linhas.length > 0 && (
                    <button className="nb-btn nb-btn-quiet" style={{ fontSize: 12, padding: '4px 8px' }}
                      onClick={() => setSel((s) => (s.size === linhas.length ? new Set() : new Set(linhas.map((l) => l.id))))}>
                      {sel.size === linhas.length ? 'Limpar' : 'Todos'}
                    </button>
                  )}
                </div>
                {carregando ? (
                  <div className="v2-skel" style={{ height: 80, borderRadius: 10 }} />
                ) : linhas.length === 0 ? (
                  <p style={{ fontSize: 13, color: 'var(--nb-ink-faint)', margin: 0, padding: '10px 0' }}>Nenhum atendimento pendente para esta profissional no período.</p>
                ) : (
                  <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--nb-rule)', borderRadius: 10 }}>
                    {linhas.map((l) => (
                      <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid var(--nb-rule-soft)', cursor: 'pointer' }}>
                        <input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} style={{ accentColor: 'var(--nb-accent)' }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                          <span style={{ color: 'var(--nb-ink)' }}>{dCurta(l.data)}</span>
                          {l.tipo === 'fiado' && <span className="nb-badge nb-warn" style={{ marginLeft: 6, fontSize: 10 }}>Fiado</span>}
                        </span>
                        <span className="nb-num" style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-ink)' }}>{brl(l.comissao)}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* forma + data */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label="Forma do pagamento">
                  <select className="v2-select" value={forma} onChange={(e) => setForma(e.target.value)} style={{ width: '100%' }}>
                    {FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Campo>
                <Campo label="Data do pagamento">
                  <input type="date" className="v2-select" value={data} onChange={(e) => setData(e.target.value)} style={{ width: '100%', paddingRight: 12 }} />
                </Campo>
              </div>
              <Campo label="Observação (opcional)">
                <input className="nb-input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: pago via Pix chave celular" style={{ width: '100%' }} />
              </Campo>
            </>
          ) : (
            /* passo de confirmação */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="nb-eyebrow" style={{ fontSize: 10 }}>Confira antes de confirmar</span>
              <ConfLinha label="Comissão total do período" v={brl(prof.comissaoTotal)} />
              <ConfLinha label="Já pago" v={brl(prof.jaPago)} />
              <ConfLinha label="Saldo atual" v={brl(prof.saldo)} />
              <ConfLinha label="Este pagamento" v={brl(estePagamento)} destaque />
              <ConfLinha label="Saldo após o pagamento" v={brl(saldoApos)} tone={saldoApos <= 0.005 ? 'ok' : undefined} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: 4 }}>
                <Icon name="CreditCard" size={14} /> {FORMAS.find(([v]) => v === forma)?.[1]} · {dCurta(data)}
              </div>
              {parcial && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--nb-warn-bg)', border: '1px solid var(--nb-rule)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--nb-warn)' }}>
                  <Icon name="TriangleAlert" size={15} />
                  <span>Pagamento parcial: {sel.size} de {linhas.length} atendimentos. O restante continuará como saldo pendente.</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          {!confirmar ? (
            <>
              <Button variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
              <Button icon="ArrowRight" onClick={() => setConfirmar(true)} disabled={carregando || sel.size === 0} style={{ flex: 1, justifyContent: 'center' }}>
                Revisar · {brl(estePagamento)}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setConfirmar(false)} style={{ flex: 1, justifyContent: 'center' }}>Voltar</Button>
              <Button icon="Check" onClick={registrar} disabled={salvando} style={{ flex: 1, justifyContent: 'center' }}>
                {salvando ? 'Registrando…' : 'Confirmar pagamento'}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumo({ label, v, tone }: { label: string; v: string; tone?: 'ok' | 'accent' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)';
  return (<div style={{ minWidth: 0 }}><div className="nb-eyebrow" style={{ fontSize: 9 }}>{label}</div><div className="nb-num" style={{ fontSize: 15, fontWeight: 660, color }}>{v}</div></div>);
}
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}><span className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</span>{children}</label>);
}
function ConfLinha({ label, v, destaque, tone }: { label: string; v: string; destaque?: boolean; tone?: 'ok' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : destaque ? 'var(--nb-accent-deep)' : 'var(--nb-ink)';
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: destaque ? '8px 0' : '2px 0', borderTop: destaque ? '1px solid var(--nb-rule-soft)' : undefined }}>
      <span style={{ fontSize: 13, color: 'var(--nb-ink-soft)' }}>{label}</span>
      <span className="nb-num" style={{ fontSize: destaque ? 18 : 14, fontWeight: destaque ? 720 : 560, color }}>{v}</span>
    </div>
  );
}
