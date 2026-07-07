'use client';

import { Card, CardHead } from '@/components/v2/ui/Card';
import Icon from '@/components/v2/ui/Icon';
import { brl } from '@/lib/v2/formatters';
import { EmptyState, GRAVIDADE_TONE, type DashResp } from './_shared';

const ICONE: Record<string, string> = {
  fiados: 'Clock', fiado: 'Clock', caixa: 'Banknote', despesas: 'Receipt', despesa: 'Receipt',
  comissao: 'HandCoins', aniversario: 'Cake', aniversariantes: 'Cake', estoque: 'Package',
};

function valorTexto(v: DashResp['alertas'][number]['valor']) {
  if (v == null) return null;
  return typeof v === 'number' ? brl(v) : v;
}

export default function AlertasGestao({ alertas }: { alertas: DashResp['alertas'] }) {
  return (
    <Card>
      <CardHead title="Alertas de gestão" />
      {alertas.length === 0 ? (
        <EmptyState icon="ShieldCheck" titulo="Tudo em ordem." texto="Nenhum alerta no momento — sem pendências que precisem da sua atenção." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.map((a, i) => {
            const tone = GRAVIDADE_TONE[a.gravidade] || 'info';
            const nota = valorTexto(a.valor);
            return (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '36px 1fr', gap: 11, alignItems: 'start', padding: 12, borderRadius: 10, background: `var(--nb-${tone}-bg)`, border: `1px solid color-mix(in srgb, var(--nb-${tone}) 22%, transparent)` }}>
                <span aria-hidden style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--nb-surface)', color: `var(--nb-${tone})`, display: 'grid', placeItems: 'center' }}>
                  <Icon name={ICONE[a.tipo] || 'CircleAlert'} size={17} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--nb-ink)' }}>{a.titulo}</div>
                  {nota && <div className="nb-num" style={{ fontSize: 12, color: 'var(--nb-ink-soft)' }}>{nota}</div>}
                  {a.acao && (
                    <a href={a.acao.href} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 560, color: 'var(--nb-accent)', textDecoration: 'none', marginTop: 4 }}>
                      {a.acao.label} <Icon name="ArrowRight" size={12} />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
