'use client';

import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import Portal from '@/components/v2/ui/Portal';
import { brl } from '@/lib/v2/formatters';
import { Avatar } from '@/components/v2/lancamentos/_shared';
import PayIcon, { labelForma } from '@/components/v2/lancamentos/PayIcon';

/* ============================================================================
   PagamentoFiadoModal — registrar o recebimento de um fiado (V2 premium).
   Reusa a API de produção POST /api/fiados (formato exato), sem tocar nela.

   ⚠️ DIVERGÊNCIA documentada (regra financeira NÃO muda aqui):
   a POST /api/fiados registra UM pagamento por fiado e marca o lançamento como
   'concluido' (quita) — qualquer valor encerra o fiado e um segundo POST é
   rejeitado ("já foi pago"). Portanto NÃO existe pagamento parcial que deixe
   saldo pendente do lado do servidor. O modal reflete isso com honestidade:
   um valor menor que o saldo quita o fiado e baixa o restante (não fica
   pendente). A comissão é recalculada no servidor sobre o valor pago.
   ============================================================================ */

export type FiadoTarget = {
  lancamentoId: number;
  clienteNome: string;
  colaboradorNome?: string | null;
  valorTotal: number;
  jaPago: number;   // soma de pagamentos_fiado já registrados
  saldo: number;    // valorTotal - jaPago (em aberto)
  dataServico?: string | null;
};

type Forma = [codigo: string, nome: string];
const FORMAS_FALLBACK: Forma[] = [
  ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['cartao_debito', 'Débito'],
  ['cartao_credito', 'Crédito'], ['transferencia', 'Transferência'],
];

const hojeBRT = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const dCurta = (iso?: string | null) => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};
const round2 = (v: number) => Math.round(v * 100) / 100;

export default function PagamentoFiadoModal({ fiado, onClose, onDone }: {
  fiado: FiadoTarget;
  onClose: () => void;
  onDone: () => void;
}) {
  const [formas, setFormas] = useState<Forma[]>(FORMAS_FALLBACK);
  const [valor, setValor] = useState(fiado.saldo.toFixed(2));
  const [forma, setForma] = useState('pix');
  const [data, setData] = useState(hojeBRT());
  const [obs, setObs] = useState('');
  const [confirmar, setConfirmar] = useState(false);
  const [permitirExcedente, setPermitirExcedente] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Formas de pagamento reais (códigos/taxas do banco) — casam com o cálculo da POST.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch('/api/v2/config', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        const lista: Forma[] = (j.formas || [])
          .filter((f: any) => f.ativo !== false && !['fiado', 'troca_gratis', 'troca'].includes(f.codigo))
          .sort((a: any, b: any) => (a.ordem ?? 0) - (b.ordem ?? 0))
          .map((f: any) => [f.codigo, f.nome] as Forma);
        if (vivo && lista.length) {
          setFormas(lista);
          if (!lista.some(([c]) => c === 'pix')) setForma(lista[0][0]);
        }
      } catch { /* mantém fallback */ }
    })();
    return () => { vivo = false; };
  }, []);

  // ESC fecha
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const valorNum = useMemo(() => {
    const v = Number(String(valor).replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }, [valor]);

  const excedeSaldo = valorNum > fiado.saldo + 0.01;          // acima do que está em aberto
  const excedeTotal = valorNum > fiado.valorTotal + 0.01;     // acima do que a API aceita (hard cap)
  const parcial = valorNum > 0 && valorNum < fiado.saldo - 0.01;
  const saldoApos = round2(Math.max(0, fiado.saldo - valorNum));
  const restanteBaixado = parcial ? round2(fiado.saldo - valorNum) : 0;

  const podeAvancar =
    valorNum > 0 &&
    !excedeTotal &&
    (!excedeSaldo || permitirExcedente);

  async function registrar() {
    setSalvando(true);
    try {
      const r = await fetch('/api/fiados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lancamentoId: fiado.lancamentoId,
          valorPago: round2(valorNum),
          formaPagamento: forma,
          dataPagamento: data,
          observacoes: obs.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) { toast.error(j.error || 'Não foi possível registrar o pagamento.'); return; }
      toast.success(`Pagamento de ${brl(round2(valorNum))} registrado. Fiado quitado.`);
      onDone();
    } catch { toast.error('Erro de conexão.'); }
    finally { setSalvando(false); }
  }

  const formaNome = (c: string) => formas.find(([v]) => v === c)?.[1] || labelForma(c);

  return (
    <Portal>
    <div role="dialog" aria-modal="true" aria-label="Registrar pagamento de fiado" onClick={onClose}
      className="fiadomodal-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'color-mix(in srgb, var(--nb-ink) 34%, transparent)', backdropFilter: 'blur(2px)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 640px) {
          .fiadomodal-overlay { padding: 10px !important; }
          .fiadomodal-card { max-height: 94dvh !important; }
          .fiadomodal-header { padding: 13px 14px !important; }
          .fiadomodal-body { padding: 14px !important; gap: 13px !important; }
          .fiadomodal-footer { padding: 12px 14px !important; }
          .fiadomodal-resumo { gap: 8px !important; padding: 11px !important; }
          .fiadomodal-resumo .nb-num { font-size: 13.5px !important; }
          .fiadomodal-grid2 { grid-template-columns: 1fr !important; }
          .fiadomodal-chip { padding: 9px 12px !important; }
        }
      ` }} />
      <div onClick={(e) => e.stopPropagation()} className="nb-card fiadomodal-card" style={{ width: '100%', maxWidth: 500, maxHeight: '92dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* header */}
        <div className="fiadomodal-header" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ flex: '0 0 auto', width: 40, height: 40, borderRadius: 12, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center' }}>
            <Icon name="HandCoins" size={20} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Receber fiado</div>
            <div style={{ fontSize: 16, fontWeight: 620, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fiado.clienteNome}</div>
          </div>
          <button className="nb-btn nb-btn-quiet" onClick={onClose} aria-label="Fechar"><Icon name="X" size={18} /></button>
        </div>

        <div className="fiadomodal-body" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* resumo do lançamento */}
          <div className="fiadomodal-resumo" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', borderRadius: 12, padding: 12 }}>
            <Resumo label="Valor total" v={brl(fiado.valorTotal)} />
            <Resumo label="Já pago" v={brl(fiado.jaPago)} tone={fiado.jaPago > 0 ? 'ok' : undefined} />
            <Resumo label="Em aberto" v={brl(fiado.saldo)} tone="warn" />
          </div>
          {fiado.colaboradorNome && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: -6 }}>
              <Avatar nome={fiado.colaboradorNome} size={22} /> Atendimento com {fiado.colaboradorNome}
              {fiado.dataServico && <span style={{ color: 'var(--nb-ink-faint)' }}>· {dCurta(fiado.dataServico)}</span>}
            </div>
          )}

          {!confirmar ? (
            <>
              {/* valor a pagar */}
              <Campo label="Valor recebido">
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--nb-ink-faint)', fontFamily: 'var(--nb-mono)' }}>R$</span>
                  <input
                    className="nb-input nb-num" inputMode="decimal" value={valor}
                    onChange={(e) => setValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                    style={{ paddingLeft: 38, fontSize: 16, fontWeight: 600 }}
                    aria-label="Valor recebido"
                  />
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button type="button" className="nb-btn nb-btn-quiet fiadomodal-chip" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setValor(fiado.saldo.toFixed(2)); setPermitirExcedente(false); }}>
                    Saldo total · {brl(fiado.saldo)}
                  </button>
                  {fiado.saldo > 0 && (
                    <button type="button" className="nb-btn nb-btn-quiet fiadomodal-chip" style={{ fontSize: 12, padding: '4px 10px' }} onClick={() => { setValor((fiado.saldo / 2).toFixed(2)); setPermitirExcedente(false); }}>
                      Metade
                    </button>
                  )}
                </div>
              </Campo>

              {excedeTotal && (
                <Aviso tone="bad" icon="TriangleAlert">
                  O valor não pode ultrapassar o valor total do fiado ({brl(fiado.valorTotal)}).
                </Aviso>
              )}
              {excedeSaldo && !excedeTotal && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: 'var(--nb-warn-bg)', border: '1px solid #E7D4B4', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: 'var(--nb-warn)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={permitirExcedente} onChange={(e) => setPermitirExcedente(e.target.checked)} style={{ accentColor: 'var(--nb-accent)', marginTop: 2 }} />
                  <span>Valor acima do saldo em aberto ({brl(fiado.saldo)}). Confirmo que quero registrar mesmo assim.</span>
                </label>
              )}

              {/* forma + data */}
              <div className="fiadomodal-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Campo label="Forma de pagamento">
                  <select className="v2-select" value={forma} onChange={(e) => setForma(e.target.value)} style={{ width: '100%' }}>
                    {formas.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Campo>
                <Campo label="Data do pagamento">
                  <input type="date" className="nb-input nb-num" value={data} max={hojeBRT()} onChange={(e) => setData(e.target.value)} style={{ width: '100%' }} />
                </Campo>
              </div>
              <p style={{ margin: '-6px 0 0', fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>O valor entra no faturamento desta data. A comissão é recalculada no servidor sobre o valor recebido.</p>

              <Campo label="Observação (opcional)">
                <input className="nb-input" value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: recebido via Pix chave celular" style={{ width: '100%' }} />
              </Campo>
            </>
          ) : (
            /* passo de confirmação */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span className="nb-eyebrow" style={{ fontSize: 10 }}>Confira antes de confirmar</span>
              <ConfLinha label="Valor total do fiado" v={brl(fiado.valorTotal)} />
              <ConfLinha label="Já pago" v={brl(fiado.jaPago)} />
              <ConfLinha label="Saldo em aberto" v={brl(fiado.saldo)} />
              <ConfLinha label="Este pagamento" v={brl(round2(valorNum))} destaque />
              <ConfLinha label="Saldo após" v={brl(saldoApos)} tone={saldoApos <= 0.005 ? 'ok' : undefined} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: 4 }}>
                <PayIcon forma={forma} size={16} /> {formaNome(forma)} · {dCurta(data)}
              </div>
              {parcial ? (
                <Aviso tone="warn" icon="TriangleAlert">
                  Pagamento parcial: o fiado será <strong>quitado</strong> com este recebimento e o restante ({brl(restanteBaixado)}) será baixado — ele <strong>não</strong> ficará como saldo pendente.
                </Aviso>
              ) : (
                <Aviso tone="ok" icon="CircleCheck">
                  Este recebimento <strong>quita</strong> o fiado por completo.
                </Aviso>
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="fiadomodal-footer" style={{ display: 'flex', gap: 10, padding: '14px 18px', borderTop: '1px solid var(--nb-rule)' }}>
          {!confirmar ? (
            <>
              <Button variant="ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancelar</Button>
              <Button icon="ArrowRight" onClick={() => setConfirmar(true)} disabled={!podeAvancar} style={{ flex: 1, justifyContent: 'center' }}>
                Revisar · {brl(round2(valorNum))}
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
    </Portal>
  );
}

function Resumo({ label, v, tone }: { label: string; v: string; tone?: 'ok' | 'warn' }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)';
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
function Aviso({ tone, icon, children }: { tone: 'warn' | 'bad' | 'ok'; icon: string; children: React.ReactNode }) {
  const map = {
    warn: { c: 'var(--nb-warn)', bg: 'var(--nb-warn-bg)', bd: '#E7D4B4' },
    bad: { c: 'var(--nb-bad)', bg: 'var(--nb-bad-bg)', bd: '#E7CFC9' },
    ok: { c: 'var(--nb-ok)', bg: 'var(--nb-ok-bg)', bd: '#CFE1D5' },
  }[tone];
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: map.bg, border: `1px solid ${map.bd}`, borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: map.c, lineHeight: 1.5 }}>
      <span style={{ flex: '0 0 auto', marginTop: 1 }}><Icon name={icon} size={15} /></span>
      <span>{children}</span>
    </div>
  );
}
