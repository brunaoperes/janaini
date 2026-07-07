'use client';

/** Estados de negócio → classe de cor semântica (separada do acento da marca). */
const MAP: Record<string, { cls: string; label: string }> = {
  pago:        { cls: 'nb-ok',   label: 'Pago' },
  concluido:   { cls: 'nb-ok',   label: 'Concluído' },
  confirmado:  { cls: 'nb-ok',   label: 'Confirmado' },
  pago_total:  { cls: 'nb-ok',   label: 'Pago total' },
  pendente:    { cls: 'nb-warn', label: 'Pendente' },
  a_vencer:    { cls: 'nb-warn', label: 'A vencer' },
  pago_parcial:{ cls: 'nb-warn', label: 'Parcial' },
  fiado:       { cls: 'nb-warn', label: 'Fiado' },
  atrasado:    { cls: 'nb-bad',  label: 'Atrasado' },
  cancelado:   { cls: 'nb-bad',  label: 'Cancelado' },
  troca:       { cls: 'nb-info', label: 'Troca grátis' },
  futuro:      { cls: 'nb-info', label: 'Futuro' },
};

export default function Badge({ status, children }: { status: string; children?: string }) {
  const m = MAP[status] ?? { cls: 'nb-info', label: children ?? status };
  return <span className={`nb-badge ${m.cls}`}>{children ?? m.label}</span>;
}
