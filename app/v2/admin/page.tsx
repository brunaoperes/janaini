'use client';

import Link from 'next/link';
import PageShell from '@/components/v2/layout/PageShell';
import { Card } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { ADMIN_AREAS } from '@/lib/v2/constants/nav';

export default function AdminV2() {
  return (
    <PageShell title="Painel de Gestão" subtitle="Tudo organizado por área — o que se usa todo dia em primeiro plano">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 16 }}>
        {ADMIN_AREAS.map((area) => (
          <Card key={area.area}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span aria-hidden style={{ width: 32, height: 32, borderRadius: 9, background: 'var(--nb-accent-wash)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}><Icon name={area.icon} size={17} /></span>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 640 }}>{area.area}</h3>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {area.itens.map((it) => {
                const inner = (
                  <>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <Icon name={it.icon} size={16} className="nb-ink-soft" />
                      <span style={{ fontSize: 13.5, color: it.href ? 'var(--nb-ink)' : 'var(--nb-ink-faint)' }}>{it.label}</span>
                    </span>
                    {it.href
                      ? <Icon name="ArrowRight" size={14} className="nb-ink-faint" />
                      : <span className="nb-eyebrow" style={{ fontSize: 9.5, color: 'var(--nb-gold)' }}>em breve</span>}
                  </>
                );
                const base: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', borderRadius: 9, textDecoration: 'none' };
                return it.href ? (
                  <li key={it.label}><Link href={it.href} style={base} className="nb-row-hover">{inner}</Link></li>
                ) : (
                  <li key={it.label} style={{ ...base, cursor: 'default' }}>{inner}</li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
