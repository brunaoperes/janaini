'use client';

import { ReactNode } from 'react';
import Topbar from './Topbar';

/** Cabeçalho (Topbar) + área de conteúdo com respiro e largura controlada. */
export default function PageShell({ title, subtitle, actions, children }: { title: string; subtitle?: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Topbar title={title} subtitle={subtitle} actions={actions} />
      <div style={{ padding: 'clamp(18px,3vw,30px)', maxWidth: 1440, width: '100%', margin: '0 auto', flex: 1 }}>
        {children}
      </div>
    </div>
  );
}

/** Placeholder consistente para as telas ainda não redesenhadas (Fase 3+). */
export function EmConstrucao({ fase, nota }: { fase: string; nota?: string }) {
  return (
    <div className="nb-card nb-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center', padding: '56px 24px' }}>
      <span className="nb-eyebrow" style={{ color: 'var(--nb-gold)' }}>{fase}</span>
      <p style={{ margin: 0, fontFamily: 'var(--nb-serif)', fontSize: 20, color: 'var(--nb-ink)' }}>Tela em construção na V2</p>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--nb-ink-soft)', maxWidth: '46ch' }}>
        {nota || 'A estrutura e a navegação já estão prontas. O redesenho completo desta tela entra na fase indicada — a versão atual em produção continua intacta e funcionando.'}
      </p>
    </div>
  );
}
