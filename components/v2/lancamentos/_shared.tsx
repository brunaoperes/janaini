'use client';

import { iniciais } from '@/lib/v2/formatters';

/* ============================================================
   Contrato /api/v2/lancamentos
   ============================================================ */
export type LancItem = {
  id: number;
  data: string;
  hora_inicio: string | null;
  hora_fim: string | null;
  cliente_id: number | null;
  colaborador_id: number | null;
  cliente_nome: string;
  colaborador_nome: string;
  servicos_nomes: string | null;
  valor_total: number;
  comissao_colaborador: number | null;
  comissao_salao: number | null;
  taxa_pagamento: number | null;
  forma_pagamento: string | null;
  status: string | null;
  is_fiado: boolean;
  is_troca_gratis: boolean;
  valor_referencia: number | null;
  observacoes: string | null;
  saldo_fiado: number;
  pago_fiado: number;
  situacao: Situacao;
};

export type Situacao = 'concluido' | 'pendente' | 'parcial' | 'fiado' | 'cancelado' | 'troca';

export type KpiVal = { valor: number; count: number };
export type LancResp = {
  itens: LancItem[];
  paginacao: { page: number; limit: number; total: number; paginas: number };
  kpis: { realizado: KpiVal; comissao: KpiVal; taxas: KpiVal; salao: KpiVal; fiadoAberto: KpiVal };
  strip: { recebido: KpiVal; pendente: KpiVal; ticket: KpiVal };
  resumo: any;
  periodo: { tipo: string; label: string; de: string | null; ate: string | null };
  colaboradores: { id: number; nome: string }[];
};

export type Filtros = {
  periodo: string; de: string; ate: string;
  colaborador_id: string; forma: string; situacao: string;
  busca: string; ordenar: string; dir: 'asc' | 'desc';
  limit: number; page: number;
};

export const FILTROS_INICIAIS: Filtros = {
  periodo: 'hoje', de: '', ate: '',
  colaborador_id: '', forma: 'todas', situacao: 'todas',
  busca: '', ordenar: 'data', dir: 'desc', limit: 25, page: 1,
};

/* ============================================================
   Badge de situação (cores sóbrias — parcial=mauve, fiado=vinho, troca=taupe)
   ============================================================ */
const SIT: Record<Situacao, { label: string; fg: string; bg: string; bd: string }> = {
  concluido: { label: 'Concluído', fg: 'var(--nb-ok)', bg: 'var(--nb-ok-bg)', bd: '#CFE1D5' },
  pendente: { label: 'Pendente', fg: 'var(--nb-warn)', bg: 'var(--nb-warn-bg)', bd: '#E7D4B4' },
  parcial: { label: 'Parcial', fg: 'var(--nb-accent)', bg: 'var(--nb-accent-wash)', bd: '#E7D2D8' },
  fiado: { label: 'Fiado', fg: 'var(--nb-accent-deep)', bg: '#F3E9EC', bd: '#E2CBD3' },
  cancelado: { label: 'Cancelado', fg: 'var(--nb-bad)', bg: 'var(--nb-bad-bg)', bd: '#E7CFC9' },
  troca: { label: 'Troca grátis', fg: 'var(--nb-ink-soft)', bg: 'var(--nb-surface-2)', bd: 'var(--nb-rule)' },
};

export function SitBadge({ s }: { s: Situacao }) {
  const m = SIT[s] ?? SIT.pendente;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--nb-mono)', fontSize: 10.5,
      letterSpacing: '.03em', textTransform: 'uppercase', fontWeight: 600, padding: '3px 9px', borderRadius: 20,
      color: m.fg, background: m.bg, border: `1px solid ${m.bd}`, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 50, background: m.fg }} />
      {m.label}
    </span>
  );
}

/* ============================================================
   Avatar de iniciais (profissional)
   ============================================================ */
export function Avatar({ nome, size = 26 }: { nome: string; size?: number }) {
  return (
    <span aria-hidden style={{
      flex: '0 0 auto', width: size, height: size, borderRadius: '50%', background: 'var(--nb-accent-wash)',
      color: 'var(--nb-accent-deep)', display: 'grid', placeItems: 'center', fontSize: size * 0.4, fontWeight: 700,
      fontFamily: 'var(--nb-sans)', letterSpacing: '.02em',
    }}>
      {iniciais(nome || '—') || '—'}
    </span>
  );
}

/** 'YYYY-MM-DD...' → { dia:'07/07', hora:'14:30' } */
export function partesData(iso?: string | null, hora?: string | null): { dia: string; hora: string } {
  if (!iso) return { dia: '—', hora: '' };
  const d = iso.slice(0, 10).split('-');
  const h = hora?.slice(0, 5) || /T(\d{2}:\d{2})/.exec(iso)?.[1] || '';
  return { dia: `${d[2]}/${d[1]}`, hora: h };
}
