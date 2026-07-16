'use client';

import { useEffect } from 'react';
import Icon from '@/components/v2/ui/Icon';
import Portal from '@/components/v2/ui/Portal';
import { brl, num, pct, iniciais } from '@/lib/v2/formatters';
import Sparkline from './Sparkline';
import type { Colab } from './types';

export default function DesempenhoDrawer({ colab, mesLabel, rankPos, totalFat, totalAtend, onClose, onEditar }: {
  colab: Colab;
  mesLabel: string;
  rankPos: number | null;
  totalFat: number;
  totalAtend: number;
  onClose: () => void;
  onEditar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const temSpark = colab.sparkline.length > 0 && colab.sparkline.some((v) => v > 0);
  const shareFat = totalFat > 0 ? (colab.faturamento / totalFat) * 100 : 0;
  const shareAtend = totalAtend > 0 ? (colab.atendimentos / totalAtend) * 100 : 0;

  return (
    <Portal>
    <div role="dialog" aria-modal="true" aria-label={`Desempenho de ${colab.nome}`} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'color-mix(in srgb, var(--nb-ink) 32%, transparent)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={(e) => e.stopPropagation()} className="v2-drawer-panel"
        style={{ width: 'min(440px, 100%)', height: '100%', background: 'var(--nb-surface)', borderLeft: '1px solid var(--nb-rule)', boxShadow: 'var(--nb-shadow-md)', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: 20, borderBottom: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ flex: '0 0 auto', width: 50, height: 50, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 17, fontWeight: 640 }}>{iniciais(colab.nome)}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontFamily: 'var(--nb-serif)', fontSize: 19, color: 'var(--nb-ink)', lineHeight: 1.2 }}>{colab.nome}</div>
            <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: 2 }}>{colab.funcao || 'Função não definida'}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span className="nb-badge" style={{ borderColor: 'var(--nb-accent)', color: 'var(--nb-accent-deep)', background: 'var(--nb-accent-wash)' }}>
                <span className="nb-num">{pct(colab.porcentagem_comissao, { casas: 0 })}</span> comissão
              </span>
              <span className={`nb-badge ${colab.ativo ? 'nb-ok' : 'nb-bad'}`}>{colab.ativo ? 'Ativa' : 'Inativa'}</span>
              {rankPos != null && <span className="nb-badge nb-info">#{rankPos} no ranking</span>}
            </div>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} className="nb-btn nb-btn-ghost" style={{ padding: 7 }}><Icon name="X" size={16} /></button>
        </div>

        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="nb-eyebrow">Desempenho de {mesLabel}</div>

          {colab.telefone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--nb-ink-soft)' }}>
              <Icon name="Phone" size={14} /><span className="nb-num">{colab.telefone}</span>
            </div>
          )}

          {/* métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Bloco label="Faturamento" value={brl(colab.faturamento)} />
            <Bloco label="Comissão realizada" value={brl(colab.comissao)} tone="accent" />
            <Bloco label="Atendimentos" value={num(colab.atendimentos)} />
            <Bloco label="Ticket médio" value={brl(colab.ticket)} />
          </div>

          {/* participação */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Participação na equipe</div>
            <Barra label="Faturamento" pctv={shareFat} texto={`${pct(shareFat, { casas: 1 })} do total`} />
            <Barra label="Atendimentos" pctv={shareAtend} texto={`${pct(shareAtend, { casas: 1 })} do total`} />
          </div>

          {/* evolução */}
          <div>
            <div className="nb-eyebrow" style={{ fontSize: 9.5, marginBottom: 8 }}>Evolução no mês</div>
            {temSpark ? (
              <div style={{ background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule-soft)', borderRadius: 12, padding: 14 }}>
                <Sparkline values={colab.sparkline} height={56} />
              </div>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: 'var(--nb-ink-faint)', fontStyle: 'italic' }}>Sem movimento registrado neste mês.</p>
            )}
          </div>

          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--nb-ink-faint)', lineHeight: 1.5 }}>
            Serviços mais realizados e formas de pagamento por colaboradora ainda não estão disponíveis nesta visão.
          </p>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/v2/agenda" className="nb-btn nb-btn-ghost" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>
              <Icon name="CalendarDays" size={15} /> Ver agenda
            </a>
            <button type="button" onClick={onEditar} className="nb-btn nb-btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              <Icon name="UserCog" size={15} /> Editar
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}

function Bloco({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <div style={{ background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule-soft)', borderRadius: 12, padding: '12px 14px' }}>
      <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 18, fontWeight: 680, marginTop: 4, color: tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)' }}>{value}</div>
    </div>
  );
}

function Barra({ label, pctv, texto }: { label: string; pctv: number; texto: string }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: 'var(--nb-ink-soft)' }}>{label}</span>
        <span className="nb-num" style={{ color: 'var(--nb-ink)', fontWeight: 560 }}>{texto}</span>
      </div>
      <span aria-hidden className="v2-track"><span style={{ width: `${Math.max(2, Math.min(100, pctv))}%`, background: 'var(--nb-accent)' }} /></span>
    </div>
  );
}
