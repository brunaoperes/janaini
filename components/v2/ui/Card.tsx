'use client';

import { ReactNode } from 'react';
import Icon from './Icon';

/** Card base V2: superfície marfim, borda hairline, sombra mínima. */
export function Card({ children, className = '', pad = true }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <div className={`nb-card ${pad ? 'nb-card-pad' : ''} ${className}`}>{children}</div>;
}

/** Cabeçalho de card com título, ação opcional à direita e link "ver mais". */
export function CardHead({ title, right, action }: { title: string; right?: ReactNode; action?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
      <h3 style={{ margin: 0, fontSize: 15.5, fontWeight: 640, color: 'var(--nb-ink)' }}>{title}</h3>
      {right}
      {action && (
        <a href={action.href} onClick={action.onClick}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 560, color: 'var(--nb-accent)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {action.label} <Icon name="ArrowRight" size={13} />
        </a>
      )}
    </div>
  );
}
