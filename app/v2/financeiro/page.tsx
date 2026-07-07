'use client';

import PageShell, { EmConstrucao } from '@/components/v2/layout/PageShell';

export default function V2Page() {
  return (
    <PageShell title="Financeiro" subtitle="Contas a pagar, DRE e fluxo de caixa">
      <EmConstrucao fase="Fase 3.5" nota="DRE, contas fixas, fluxo de caixa e margem com a camada financeira unificada da Fase 1." />
    </PageShell>
  );
}
