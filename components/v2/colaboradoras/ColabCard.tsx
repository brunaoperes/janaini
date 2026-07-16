'use client';

import Icon from '@/components/v2/ui/Icon';
import { brl, num, pct, iniciais } from '@/lib/v2/formatters';
import Sparkline from './Sparkline';
import type { Colab } from './types';

export default function ColabCard({ c, destaque, onEditar, onDesempenho, onAgenda }: {
  c: Colab;
  destaque?: boolean;
  onEditar: () => void;
  onDesempenho: () => void;
  onAgenda: () => void;
}) {
  const temSpark = c.sparkline.length > 0 && c.sparkline.some((v) => v > 0);
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative', ...(destaque ? { borderColor: 'var(--nb-gold)', boxShadow: '0 8px 24px -16px rgba(169,137,83,.55)' } : {}) }}>
      {destaque && (
        <span style={{ position: 'absolute', top: 14, right: 14, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'var(--nb-mono)', fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 700, color: 'var(--nb-gold)', background: 'color-mix(in srgb, var(--nb-gold) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--nb-gold) 40%, transparent)', padding: '3px 8px', borderRadius: 20 }}>
          <Icon name="Trophy" size={11} /> Destaque do mês
        </span>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span aria-hidden style={{ flex: '0 0 auto', width: 46, height: 46, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 640 }}>{iniciais(c.nome)}</span>
        <div style={{ minWidth: 0, flex: 1, paddingRight: destaque ? 96 : 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 620, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</div>
          <div style={{ fontSize: 12.5, color: 'var(--nb-ink-soft)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.funcao || '—'}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            <span className="nb-badge" style={{ borderColor: 'var(--nb-accent)', color: 'var(--nb-accent-deep)', background: 'var(--nb-accent-wash)' }}>
              <span className="nb-num">{pct(c.porcentagem_comissao, { casas: 0 })}</span> comissão
            </span>
            <span className={`nb-badge ${c.ativo ? 'nb-ok' : 'nb-bad'}`}>{c.ativo ? 'Ativa' : 'Inativa'}</span>
          </div>
        </div>
      </div>

      {c.telefone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>
          <Icon name="Phone" size={13} /><span className="nb-num">{c.telefone}</span>
        </div>
      )}

      {temSpark ? (
        <div style={{ marginTop: 2 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9, marginBottom: 4 }}>Tendência no mês</div>
          <Sparkline values={c.sparkline} />
        </div>
      ) : (
        <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)', fontStyle: 'italic' }}>Sem movimento no período</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, paddingTop: 14, borderTop: '1px solid var(--nb-rule-soft)' }}>
        <Metrica label="Faturamento" value={brl(c.faturamento)} />
        <Metrica label="Comissão" value={brl(c.comissao)} tone="accent" />
        <Metrica label="Atend." value={num(c.atendimentos)} />
      </div>

      <div className="cbz-cardbtns" style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 12, borderTop: '1px solid var(--nb-rule-soft)', flexWrap: 'wrap' }}>
        <button type="button" onClick={onAgenda} className="nb-btn nb-btn-quiet" style={{ fontSize: 12.5, padding: '6px 8px' }}>
          <Icon name="CalendarDays" size={14} /> Ver agenda
        </button>
        <button type="button" onClick={onDesempenho} className="nb-btn nb-btn-quiet" style={{ fontSize: 12.5, padding: '6px 8px' }}>
          <Icon name="ChartNoAxesColumn" size={14} /> Ver desempenho
        </button>
        <button type="button" aria-label="Editar colaboradora" onClick={onEditar} className="nb-btn nb-btn-quiet" style={{ fontSize: 12.5, padding: '6px 8px', marginLeft: 'auto' }}>
          <Icon name="UserCog" size={14} />
        </button>
      </div>
    </div>
  );
}

function Metrica({ label, value, tone }: { label: string; value: string; tone?: 'accent' }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 15, fontWeight: 660, lineHeight: 1.15, marginTop: 3, color: tone === 'accent' ? 'var(--nb-accent-deep)' : 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  );
}
