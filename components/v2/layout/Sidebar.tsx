'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Icon from '../ui/Icon';
import { NAV_MAIN, NAV_FOOT, NavItem } from '@/lib/v2/constants/nav';
import { useV2Nav } from './nav-context';

function Item({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  return (
    <Link href={item.href} aria-current={active ? 'page' : undefined} onClick={onNavigate}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px', borderRadius: 10,
        fontSize: 14, fontWeight: active ? 600 : 460, textDecoration: 'none',
        color: active ? '#fff' : 'var(--nb-on-dark-soft)',
        background: active ? 'var(--nb-sidebar-2)' : 'transparent',
        boxShadow: active ? 'inset 2px 0 0 var(--nb-accent)' : 'none',
        transition: 'background .15s, color .15s',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--nb-on-dark)'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--nb-on-dark-soft)'; }}
    >
      <Icon name={item.icon} size={18} strokeWidth={active ? 2 : 1.75} />
      {item.label}
    </Link>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const { open, setOpen } = useV2Nav();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const close = () => setOpen(false);

  // Fecha o drawer sempre que a rota muda (navegação por link no mobile).
  useEffect(() => { setOpen(false); }, [pathname, setOpen]);

  // Trava o scroll do body enquanto o drawer está aberto (mobile).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <>
      <div className={`v2-sidebar-backdrop${open ? ' is-open' : ''}`} onClick={close} aria-hidden />

      <aside className={`v2-sidebar${open ? ' is-open' : ''}`}>
        {/* marca */}
        <Link href="/v2/dashboard" onClick={close} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '4px 8px 20px', textDecoration: 'none' }}>
          <span aria-hidden style={{
            width: 34, height: 34, borderRadius: 9, border: '1.5px solid var(--nb-gold)', color: 'var(--nb-gold)',
            display: 'grid', placeItems: 'center', fontFamily: 'var(--nb-serif)', fontSize: 15, letterSpacing: '.02em',
          }}>NB</span>
          <span style={{ fontFamily: 'var(--nb-serif)', fontSize: 20, color: '#fff', letterSpacing: '.01em' }}>NaviBelle</span>
        </Link>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', flex: 1, marginTop: 6 }}>
          {NAV_MAIN.map((i) => <Item key={i.href} item={i} active={isActive(i.href)} onNavigate={close} />)}
        </nav>

        <div style={{ borderTop: '1px solid rgba(237,231,223,.1)', paddingTop: 10, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV_FOOT.map((i) => <Item key={i.label} item={i} active={i.href !== '/v2/configuracoes' && isActive(i.href)} onNavigate={close} />)}
        </div>
      </aside>
    </>
  );
}
