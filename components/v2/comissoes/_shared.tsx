'use client';

import { iniciais } from '@/lib/v2/formatters';
import type { Situacao } from './types';
import { SIT_LABEL } from './types';

/** Ícones ausentes no registry global (Icon.tsx é intocável): SVG inline local. */
export function LocalIcon({ name, size = 16 }: { name: 'eye' | 'ellipsis' | 'history'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'eye') return (<svg {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg>);
  if (name === 'ellipsis') return (<svg {...p}><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>);
  // history
  return (<svg {...p}><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" /><path d="M12 7v5l4 2" /></svg>);
}

/** Badge de situação com cor semântica (Pago=verde, Parcial=warn/mauve, Pendente=âmbar). */
export function SitBadge({ s }: { s: Situacao }) {
  const cls = s === 'pago' ? 'nb-ok' : s === 'parcial' ? 'nb-info' : 'nb-warn';
  return <span className={`nb-badge ${cls}`}>{SIT_LABEL[s]}</span>;
}

export function Avatar({ nome, size = 32 }: { nome: string; size?: number }) {
  return (
    <span aria-hidden style={{ flex: '0 0 auto', width: size, height: size, borderRadius: '50%', background: 'var(--nb-accent-wash)', color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 640 }}>
      {iniciais(nome)}
    </span>
  );
}
