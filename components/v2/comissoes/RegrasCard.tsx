'use client';

import Icon from '@/components/v2/ui/Icon';
import { Card, CardHead } from '@/components/v2/ui/Card';

const REGRAS: { icon: string; texto: string }[] = [
  { icon: 'Percent', texto: 'A pagar = comissão líquida da profissional (o custo de maquininha já fica com o salão).' },
  { icon: 'CircleCheck', texto: 'Só entram atendimentos concluídos; cancelados, pendentes e trocas grátis não contam.' },
  { icon: 'Coins', texto: 'Fiado entra na comissão quando é efetivamente recebido, na data do recebimento.' },
  { icon: 'ScrollText', texto: 'Cada pagamento fica registrado no histórico e na auditoria — os valores são recalculados no servidor.' },
  { icon: 'TriangleAlert', texto: 'Divergência de regra? Recalcule e registre no log antes de pagar — nunca ajuste valores na mão.' },
];

export default function RegrasCard() {
  return (
    <Card>
      <CardHead title="Regras e observações" right={<Icon name="Info" size={15} />} />
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REGRAS.map((r, i) => (
          <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span aria-hidden style={{ flex: '0 0 auto', width: 28, height: 28, borderRadius: 8, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', color: 'var(--nb-accent)', display: 'grid', placeItems: 'center' }}>
              <Icon name={r.icon} size={14} />
            </span>
            <span style={{ fontSize: 13, color: 'var(--nb-ink-soft)', lineHeight: 1.5, paddingTop: 3 }}>{r.texto}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
