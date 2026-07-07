'use client';

import PageShell, { EmConstrucao } from '@/components/v2/layout/PageShell';

export default function V2Page() {
  return (
    <PageShell title="Comissoes" subtitle="Calculo e pagamento por profissional">
      <EmConstrucao fase="Fase 3.6" nota="Comissao prevista x realizada, com pagamento recalculado no servidor." />
    </PageShell>
  );
}
