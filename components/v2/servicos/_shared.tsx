'use client';

import type { CategoriaId } from './categoria';
import { LABEL_CAT } from './categoria';

/* ============================================================
   Contrato /api/v2/servicos
   ============================================================ */
export type Vendas = { qtd: number; receita: number; ultima: string | null };

export type ServicoItem = {
  id: number;
  nome: string;
  duracao_minutos: number;
  valor: number;
  descricao: string | null;
  ativo: boolean;
  colaboradores_ids: number[] | null;
  dono_colaborador_id: number | null;
  dona_nome: string | null;
  created_at: string | null;
  updated_at: string | null;
  categoria: CategoriaId;
  vendas: Vendas;
};

export type Colaboradora = { id: number; nome: string };

export type ServResp = {
  itens: ServicoItem[];
  paginacao: { page: number; limit: number; total: number; paginas: number };
  kpis: { total: number; ticketMedioAtivos: number; duracaoMediaAtivos: number; ativos: number; pctAtivos: number };
  categorias: { id: CategoriaId | 'todos'; label: string; count: number }[];
  maisVendidos: { id: number | null; nome: string; categoria: CategoriaId; quantidade: number; receita: number }[];
  colaboradoras: Colaboradora[];
  nomesTodos: { id: number; nome: string }[];
  semHistorico: boolean;
};

export type DetalheResp = {
  servico: ServicoItem;
  profissionais: Colaboradora[];
  vendas: Vendas & { ticket: number };
  recentes: { data: string; cliente_nome: string; valor: number }[];
};

export type Filtros = {
  categoria: CategoriaId | 'todos';
  status: 'todos' | 'ativos' | 'inativos';
  exclusividade: 'todos' | 'geral' | 'exclusivo';
  precoMin: string;
  precoMax: string;
  duracaoMin: string;
  duracaoMax: string;
  busca: string;
  ordenar: string;
  limit: number;
  page: number;
};

export const FILTROS_INICIAIS: Filtros = {
  categoria: 'todos', status: 'todos', exclusividade: 'todos',
  precoMin: '', precoMax: '', duracaoMin: '', duracaoMax: '',
  busca: '', ordenar: 'nome_asc', limit: 12, page: 1,
};

export const LIMITES = [10, 12, 25, 50];

export const ORDENACOES: [string, string][] = [
  ['nome_asc', 'Nome (A–Z)'],
  ['nome_desc', 'Nome (Z–A)'],
  ['preco_desc', 'Maior preço'],
  ['preco_asc', 'Menor preço'],
  ['duracao_desc', 'Maior duração'],
  ['duracao_asc', 'Menor duração'],
  ['vendas_desc', 'Mais vendidos'],
  ['atualizado_desc', 'Atualizados recentemente'],
];

/* ============================================================
   Ícone por categoria (SVG inline local — Icon.tsx não é editável)
   Traços lucide, herdam currentColor.
   ============================================================ */
const PATHS: Record<CategoriaId, React.ReactNode> = {
  cabelo: (<><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></>),
  unhas: (<><path d="M12 21c-2.5 0-4-1.6-4-4V6.5C8 4.6 9.8 3 12 3s4 1.6 4 3.5V17c0 2.4-1.5 4-4 4Z" /><path d="M8 8.5c1.3-1 6.7-1 8 0" /></>),
  sobrancelhas: (<><path d="M3 9c3-3.5 6-5 9-5s6 1.5 9 5" /><path d="M6.5 13.5c1.2 2 3.2 3 5.5 3s4.3-1 5.5-3" /></>),
  estetica: (<><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5S12.5 5 12 2.5C11.5 5 10 7.4 8 9C6 10.5 5 13 5 15a7 7 0 0 0 7 7z" /></>),
  pacotes: (<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /><path d="m7.5 4.27 9 5.15" /></>),
  outros: (<><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.4 2.4 0 0 0 3.42 0l6.58-6.58a2.4 2.4 0 0 0 0-3.42z" /><circle cx="7.5" cy="7.5" r=".9" /></>),
};

export function CategoriaIcon({ cat, size = 18 }: { cat: CategoriaId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {PATHS[cat] ?? PATHS.outros}
    </svg>
  );
}

/* ============================================================
   Badges
   ============================================================ */
export function CatBadge({ cat }: { cat: CategoriaId }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 560,
      color: 'var(--nb-ink-soft)', background: 'var(--nb-surface-2)', border: '1px solid var(--nb-rule)',
      borderRadius: 20, padding: '3px 10px 3px 8px', whiteSpace: 'nowrap',
    }}>
      <span style={{ color: 'var(--nb-accent)', display: 'inline-flex' }}><CategoriaIcon cat={cat} size={14} /></span>
      {LABEL_CAT[cat]}
    </span>
  );
}

export function StatusBadge({ ativo }: { ativo: boolean }) {
  return ativo
    ? <span className="nb-badge nb-ok">Ativo</span>
    : <span className="nb-badge" style={{ color: 'var(--nb-ink-faint)', background: 'var(--nb-surface-2)', borderColor: 'var(--nb-rule)' }}>Inativo</span>;
}

export function ExclBadge({ nome }: { nome: string | null }) {
  if (!nome) return <span className="nb-badge nb-info">Geral</span>;
  return (
    <span className="nb-badge" style={{ color: 'var(--nb-gold)', background: '#F6EFE3', borderColor: '#E7D8BE', maxWidth: 180, overflow: 'hidden' }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Exclusivo · {nome}</span>
    </span>
  );
}

/** 'YYYY-MM-DD...' → 'dd/mm/aaaa' (sem timezone). Vazio → '—'. */
export function dataBR(iso?: string | null): string {
  if (!iso) return '—';
  const d = iso.slice(0, 10).split('-');
  if (d.length < 3) return '—';
  return `${d[2]}/${d[1]}/${d[0]}`;
}
