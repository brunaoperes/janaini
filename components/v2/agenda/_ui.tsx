'use client';

import { iniciais } from '@/lib/v2/formatters';
import { STATUS_META, StatusVis } from './timeline-utils';

/** Badge de status do agendamento, na paleta V2. 'neutro' cai num pill discreto. */
export function StatusBadge({ status, size = 'md' }: { status: StatusVis; size?: 'sm' | 'md' }) {
  const m = STATUS_META[status];
  const compact = size === 'sm';
  if (m.tone === 'neutro') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--nb-mono)',
        fontSize: compact ? 9.5 : 10.5, letterSpacing: '.03em', textTransform: 'uppercase', fontWeight: 600,
        padding: compact ? '2px 7px' : '3px 9px', borderRadius: 20,
        color: 'var(--nb-ink-soft)', background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)',
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--nb-ink-faint)' }} />
        {m.label}
      </span>
    );
  }
  return <span className={`nb-badge nb-${m.tone}`} style={compact ? { fontSize: 9.5, padding: '2px 7px' } : undefined}>{m.label}</span>;
}

/** Avatar circular com iniciais na cor da profissional. */
export function Avatar({ nome, cor, size = 28 }: { nome: string; cor: string; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: '50%', background: cor, color: '#fff',
      display: 'grid', placeItems: 'center', fontSize: size <= 26 ? 10.5 : 11.5, fontWeight: 600, flex: '0 0 auto',
    }}>{iniciais(nome)}</span>
  );
}

/** 'HH:MM' a partir de minutos desde a meia-noite. */
export const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
