'use client';

import PageShell, { EmConstrucao } from '@/components/v2/layout/PageShell';

export default function V2Page() {
  return (
    <PageShell title="Relatorios" subtitle="Analises por periodo e profissional">
      <EmConstrucao fase="Fase 3.6" nota="Graficos sobrios e exportacao PDF/Excel usando a mesma regra financeira das demais telas." />
    </PageShell>
  );
}
