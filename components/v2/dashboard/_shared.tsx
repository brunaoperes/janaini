'use client';

import { ReactNode } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { brl, diaMes } from '@/lib/v2/formatters';

/* ============================================================
   Tipos do contrato /api/v2/dashboard
   ============================================================ */
export type Gran = 'hora' | 'dia' | 'mes';
export type Metric = 'faturamento' | 'caixa' | 'comissao' | 'liquido' | 'agendamentos';

export type KpiVal = { value: number; anterior?: number | null; delta?: number | null };
export type Bucket = { k: string; faturamento: number; caixa: number; comissao: number; liquido: number; agendamentos: number };

export type Filtros = { periodo: string; de: string; ate: string; colaborador: string; servico: string; forma: string };

export type DashResp = {
  filtros: Filtros;
  periodo: { tipo: string; de: string; ate: string; label: string; granularidade: Gran };
  anterior: { de: string; ate: string; label: string };
  kpis: {
    faturamentoRealizado: KpiVal;
    caixaRecebido: KpiVal & { fiadoRecebido?: number };
    liquidoSalao: KpiVal;
    comissaoRealizada: KpiVal;
    comissaoPrevista: KpiVal;
    ticketMedio: KpiVal;
    fiadosAberto: { value: number };
    ocupacao: (KpiVal & { base?: string | null }) | null;
    lucro: KpiVal & { tipo: 'real' | 'estimado'; base?: string | null };
    agendamentos: { total: number; concluidos: number; pendentes: number; cancelados: number; futuros: number; anterior?: number | null; delta?: number | null };
  };
  serie: {
    granularidade: Gran;
    buckets: Bucket[];
    anterior: Bucket[];
    resumo: { totalAtual: number; totalAnterior: number; delta: number | null; melhor: { k: string; valor: number } | null; pior: { k: string; valor: number } | null };
  };
  recebimentos: { forma: string; label: string; valor: number; pct: number; transacoes: number; taxa: number }[];
  topColaboradoras: { id: number | string; nome: string; funcao?: string | null; faturamento: number; comissao: number; atendimentos: number; ticket: number; delta?: number | null }[];
  servicosMaisVendidos: { nome: string; quantidade: number; faturamento: number; ticket: number; pct: number }[];
  proximos: { modo: 'proximos' | 'ultimos'; itens: { hora: string; data?: string; cliente: string; colaboradora?: string | null; servico?: string | null; status: string; valor: number }[] };
  alertas: { tipo: string; titulo: string; valor?: string | number | null; gravidade: 'info' | 'alerta' | 'critico'; acao?: { label: string; href: string } | null }[];
  meta: { valor: number | null; realizado: number; pct?: number | null; falta?: number | null; projecao?: number | null; mediaDiariaNecessaria?: number | null; diasRestantes?: number | null; diasDecorridos?: number | null };
  anual: null | {
    meses: { mes: number | string; faturamento: number; comissao: number; taxas: number; despesas: number; lucro: number; ticket: number; atendimentos: number }[];
    resumo: { faturamento: number; melhorMes: { mes: number | string; valor: number } | null; piorMes: { mes: number | string; valor: number } | null; mediaMensal: number; comissao: number; lucro: number; crescimentoVsAnoAnterior: number | null };
  };
};

/* ============================================================
   Formatação de rótulos de bucket / mês
   ============================================================ */
const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

export function fmtBucket(k: string, gran: Gran): string {
  if (!k) return '';
  if (gran === 'hora') {
    const h = k.includes('T') ? k.split('T')[1] : k.slice(-2);
    return `${h.slice(0, 2)}h`;
  }
  if (gran === 'mes') {
    const [, m] = k.split('-');
    return MESES_ABREV[Number(m) - 1] ?? k;
  }
  // dia — espera YYYY-MM-DD
  return /^\d{4}-\d{2}-\d{2}$/.test(k) ? diaMes(k) : k;
}

export function nomeMes(m: number | string): string {
  const n = typeof m === 'number' ? m : Number(String(m).split('-').pop());
  return MESES_ABREV[n - 1] ?? String(m);
}

/* ============================================================
   Primitivos visuais
   ============================================================ */

/** Variação vs período anterior no padrão premium: seta + % + valor anterior. */
export function Delta({ delta, anterior, anteriorLabel, fmt = brl }: {
  delta?: number | null;
  anterior?: number | null;
  anteriorLabel: string;
  fmt?: (v: number | null | undefined) => string;
}) {
  if (delta == null) {
    return <span style={{ fontSize: 11.5, color: 'var(--nb-ink-faint)' }}>Sem comparativo disponível</span>;
  }
  const dir = Math.abs(delta) < 0.05 ? 'flat' : delta > 0 ? 'up' : 'down';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, flexWrap: 'wrap' }}>
      <span className={`nb-delta nb-${dir}`}>
        {dir !== 'flat' && <Icon name={dir === 'up' ? 'TrendingUp' : 'TrendingDown'} size={13} />}
        {dir === 'flat' ? 'estável' : `${delta > 0 ? '+' : ''}${Math.round(delta)}%`}
      </span>
      <span style={{ color: 'var(--nb-ink-faint)' }}>
        {anteriorLabel}{anterior != null ? ` · ${fmt(anterior)}` : ''}
      </span>
    </div>
  );
}

/** Estado vazio profissional dentro de um card. */
export function EmptyState({ icon = 'Sparkles', titulo, texto, acao, h }: {
  icon?: string;
  titulo?: string;
  texto?: string;
  acao?: { label: string; href?: string; onClick?: () => void };
  h?: number;
}) {
  return (
    <div style={{ minHeight: h ?? 150, display: 'grid', placeItems: 'center', textAlign: 'center', padding: '18px 12px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9 }}>
        <span aria-hidden style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)', display: 'grid', placeItems: 'center', color: 'var(--nb-ink-faint)' }}>
          <Icon name={icon} size={20} />
        </span>
        {titulo && <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--nb-ink-soft)' }}>{titulo}</div>}
        {texto && <div style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)', maxWidth: '36ch', lineHeight: 1.5 }}>{texto}</div>}
        {acao && (
          <a href={acao.href} onClick={acao.onClick} className="nb-btn nb-btn-ghost" style={{ marginTop: 4, fontSize: 12.5, textDecoration: 'none' }}>
            {acao.label}
          </a>
        )}
      </div>
    </div>
  );
}

export function Skel({ h = 16, w = '100%', r = 8, style }: { h?: number | string; w?: number | string; r?: number; style?: React.CSSProperties }) {
  return <div className="v2-skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/** Segmented control genérico (toggle de métrica). */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly (readonly [T, string])[];
}) {
  return (
    <div className="v2-seg" role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={v === value} className={v === value ? 'is-on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

/** Mini-estatística rotulada (usada em resumos). */
export function Stat({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'ok' | 'bad' | 'ink'; hint?: string }) {
  const color = tone === 'ok' ? 'var(--nb-ok)' : tone === 'bad' ? 'var(--nb-bad)' : 'var(--nb-ink)';
  return (
    <div style={{ minWidth: 0 }}>
      <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
      <div className="nb-num" style={{ fontSize: 16, fontWeight: 660, color, lineHeight: 1.25 }}>{value}</div>
      {hint && <div style={{ fontSize: 10.5, color: 'var(--nb-ink-faint)', marginTop: 1 }}>{hint}</div>}
    </div>
  );
}

/** Cor semântica por gravidade de alerta. */
export const GRAVIDADE_TONE: Record<string, string> = { info: 'info', alerta: 'warn', critico: 'bad' };
