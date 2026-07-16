'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '../ui/Icon';
import { iniciais } from '@/lib/v2/formatters';
import { useV2Nav } from './nav-context';

export default function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { profile } = useAuth();
  const { toggle } = useV2Nav();
  const nome = profile?.nome || profile?.username || 'Administradora';

  return (
    <header style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
      padding: '18px clamp(14px,3vw,34px)', borderBottom: '1px solid var(--nb-rule)',
      position: 'sticky', top: 0, zIndex: 20, background: 'color-mix(in srgb, var(--nb-ground) 88%, transparent)',
      backdropFilter: 'blur(8px)', flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button type="button" aria-label="Abrir menu" onClick={toggle} className="nb-btn nb-btn-quiet v2-nav-hamburger" style={{ padding: 8, flexShrink: 0 }}>
          <Icon name="Menu" size={22} />
        </button>
        <div style={{ minWidth: 0 }}>
          <h1 className="nb-display" style={{ margin: 0, fontSize: 'clamp(20px,4.5vw,26px)', lineHeight: 1.1, color: 'var(--nb-ink)' }}>{title}</h1>
          {subtitle && <p style={{ margin: '2px 0 0', fontSize: 13.5, color: 'var(--nb-ink-soft)' }}>{subtitle}</p>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {actions}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 12, borderLeft: '1px solid var(--nb-rule)' }}>
          <span aria-hidden style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--nb-accent-deep)', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 600 }}>{iniciais(nome)}</span>
          <div className="v2-topbar-user" style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nb-ink)' }}>{nome}</div>
            <div style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>{profile?.role === 'admin' ? 'Administradora' : 'Colaboradora'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
