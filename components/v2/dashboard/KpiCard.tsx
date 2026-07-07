'use client';

import { ReactNode } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { Delta } from './_shared';

/**
 * Card de KPI de gestão: valor grande, variação vs anterior (seta + valor
 * anterior em texto), drill-down "Ver detalhes" e slot para conteúdo extra
 * (quebra de agendamentos, tag real/estimado, base de ocupação).
 */
export default function KpiCard({
  label, icon, value, delta, anterior, anteriorLabel, href, tone = 'default', fmtDelta, footer, semComparativo, children,
}: {
  label: string;
  icon: string;
  value: string;
  delta?: number | null;
  anterior?: number | null;
  anteriorLabel: string;
  href?: string;
  tone?: 'default' | 'warn' | 'ok';
  fmtDelta?: (v: number | null | undefined) => string;
  footer?: ReactNode;      // texto/estado quando não há comparativo (ex.: fiados)
  semComparativo?: boolean; // força "Sem comparativo disponível"
  children?: ReactNode;     // conteúdo extra (chips, tags)
}) {
  const valueColor = tone === 'warn' ? 'var(--nb-warn)' : tone === 'ok' ? 'var(--nb-ok)' : 'var(--nb-ink)';
  // Card inteiro clicável quando há href (drill-down); vira <a>, então o "Ver detalhes" interno é <span>.
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', flexDirection: 'column', gap: 9, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <span className="nb-eyebrow" style={{ paddingTop: 2 }}>{label}</span>
        <span aria-hidden style={{ flex: '0 0 auto', width: 36, height: 36, borderRadius: 10, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
          <Icon name={icon} size={18} />
        </span>
      </div>

      <div className="nb-num" style={{ fontSize: 25, fontWeight: 680, letterSpacing: '-.02em', lineHeight: 1.05, color: valueColor }}>{value}</div>

      {children}

      <div style={{ minHeight: 17 }}>
        {semComparativo
          ? (footer ?? <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>Sem comparativo disponível</span>)
          : <Delta delta={delta} anterior={anterior} anteriorLabel={anteriorLabel} fmt={fmtDelta} />}
      </div>

      {href && (
        <span className="nb-card-link-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 560, color: 'var(--nb-accent)', marginTop: 'auto' }}>
          Ver detalhes <Icon name="ArrowRight" size={12} />
        </span>
      )}
    </Root>
  );
}
