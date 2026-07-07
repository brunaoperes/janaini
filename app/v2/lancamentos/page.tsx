'use client';

import PageShell, { EmConstrucao } from '@/components/v2/layout/PageShell';

export default function V2Page() {
  return (
    <PageShell title="Lancamentos" subtitle="Controle financeiro por atendimento">
      <EmConstrucao fase="Fase 3.2" nota="Redesenho com separacao clara de bruto, taxa, liquido e comissao, filtros no servidor e fim do teto de 100 registros." />
    </PageShell>
  );
}
