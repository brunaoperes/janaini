'use client';

import Icon from './Icon';

/**
 * Card de KPI no padrão do mockup: rótulo em maiúsculas, valor grande em grafite
 * (nunca gradiente), variação vs. período anterior e ícone discreto em lavado mauve.
 */
export default function Kpi({
  label, value, icon, delta, deltaLabel, tone = 'default', href,
}: {
  label: string;
  value: string;
  icon: string;
  delta?: number;          // variação % (undefined = sem comparação)
  deltaLabel?: string;     // ex.: "vs ontem (R$ 2.076,00)"
  tone?: 'default' | 'warn';
  href?: string;           // quando presente, o card inteiro vira link de drill-down
}) {
  const dir = delta === undefined ? null : Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';
  const Root: any = href ? 'a' : 'div';
  const rootProps: any = href
    ? { href, className: 'nb-card nb-card-pad nb-card-link', 'aria-label': `${label} — ver detalhes` }
    : { className: 'nb-card nb-card-pad' };
  return (
    <Root {...rootProps} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <span className="nb-eyebrow" style={{ paddingTop: 2 }}>{label}</span>
        <span aria-hidden style={{
          flex: '0 0 auto', width: 38, height: 38, borderRadius: 10,
          background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)',
          display: 'grid', placeItems: 'center',
        }}><Icon name={icon} size={19} /></span>
      </div>
      <div className="nb-num" style={{ fontSize: 27, fontWeight: 680, letterSpacing: '-.02em', lineHeight: 1.05, color: tone === 'warn' ? 'var(--nb-warn)' : 'var(--nb-ink)' }}>{value}</div>
      {dir && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <span className={`nb-delta nb-${dir}`}>
            {dir !== 'flat' && <Icon name={dir === 'up' ? 'TrendingUp' : 'TrendingDown'} size={14} />}
            {dir === 'flat' ? '—' : `${delta! > 0 ? '+' : ''}${delta!.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`}
          </span>
          {deltaLabel && <span style={{ color: 'var(--nb-ink-faint)' }}>{deltaLabel}</span>}
        </div>
      )}
      {href && (
        <span className="nb-card-link-cta" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 560, color: 'var(--nb-accent)', marginTop: 'auto' }}>
          Ver detalhes <Icon name="ArrowRight" size={12} />
        </span>
      )}
    </Root>
  );
}
