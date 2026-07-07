'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import type { Filtros } from './_shared';

const PERIODOS: [string, string][] = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'],
  ['mes', 'Mês atual'], ['mes_anterior', 'Mês anterior'], ['ano', 'Ano atual'],
  ['futuros', 'Futuros'], ['todos', 'Todo o período'], ['custom', 'Personalizado'],
];
const FORMAS: [string, string][] = [
  ['todas', 'Todas'], ['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao_debito', 'Débito'],
  ['cartao_credito', 'Crédito'], ['fiado', 'Fiado'], ['outros', 'Outros'],
];
const SITUACOES: [string, string][] = [
  ['todas', 'Todas'], ['concluido', 'Concluído'], ['pendente', 'Pendente'], ['parcial', 'Parcial'],
  ['fiado', 'Fiado'], ['cancelado', 'Cancelado'], ['troca', 'Troca grátis'],
];

// Atalhos rápidos (abas) → combinação de período + situação
export const ABAS: { id: string; label: string; patch: Partial<Filtros> }[] = [
  { id: 'hoje', label: 'Hoje', patch: { periodo: 'hoje', situacao: 'todas' } },
  { id: 'pendentes', label: 'Pendentes', patch: { periodo: 'todos', situacao: 'pendente' } },
  { id: 'finalizados', label: 'Finalizados', patch: { periodo: 'mes', situacao: 'concluido' } },
  { id: 'futuros', label: 'Futuros', patch: { periodo: 'futuros', situacao: 'todas' } },
  { id: 'todos', label: 'Todos', patch: { periodo: 'todos', situacao: 'todas' } },
];

type Opt = { id: number | string; nome: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="v2-field"><label>{label}</label>{children}</div>;
}

export default function FilterBar({
  filtros, periodoLabel, abaAtiva, colaboradoras, temFiltro,
  onChange, onAba, onClear, onExport, onNovo, exporting,
}: {
  filtros: Filtros;
  periodoLabel: string;
  abaAtiva: string | null;
  colaboradoras: Opt[];
  temFiltro: boolean;
  onChange: (patch: Partial<Filtros>) => void;
  onAba: (patch: Partial<Filtros>) => void;
  onClear: () => void;
  onExport: () => void;
  onNovo: () => void;
  exporting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ativos = [
    filtros.colaborador_id !== '', filtros.forma !== 'todas', filtros.situacao !== 'todas',
    filtros.busca.trim() !== '', filtros.periodo !== 'hoje',
  ].filter(Boolean).length;

  const controls = (
    <>
      <Field label="Período">
        <select className="v2-select" value={filtros.periodo} onChange={(e) => onChange({ periodo: e.target.value })}>
          {PERIODOS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      {filtros.periodo === 'custom' && (
        <>
          <Field label="De">
            <input type="date" className="v2-select" style={{ paddingRight: 12 }} value={filtros.de || ''} onChange={(e) => onChange({ de: e.target.value })} />
          </Field>
          <Field label="Até">
            <input type="date" className="v2-select" style={{ paddingRight: 12 }} value={filtros.ate || ''} onChange={(e) => onChange({ ate: e.target.value })} />
          </Field>
        </>
      )}

      <Field label="Profissional">
        <select className="v2-select" value={filtros.colaborador_id} onChange={(e) => onChange({ colaborador_id: e.target.value })}>
          <option value="">Todas</option>
          {colaboradoras.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
        </select>
      </Field>

      <Field label="Forma">
        <select className="v2-select" value={filtros.forma} onChange={(e) => onChange({ forma: e.target.value })}>
          {FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Situação">
        <select className="v2-select" value={filtros.situacao} onChange={(e) => onChange({ situacao: e.target.value })}>
          {SITUACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Buscar">
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}>
            <Icon name="Search" size={15} />
          </span>
          <input
            className="v2-select" style={{ paddingLeft: 32, paddingRight: 12, cursor: 'text', minWidth: 180 }}
            placeholder="Cliente, serviço, profissional…" value={filtros.busca}
            onChange={(e) => onChange({ busca: e.target.value })}
          />
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {temFiltro && (
          <button className="nb-btn nb-btn-quiet" onClick={onClear} style={{ fontSize: 13 }}>
            <Icon name="RotateCcw" size={15} /> Limpar
          </button>
        )}
        <button className="nb-btn nb-btn-ghost" onClick={onExport} disabled={exporting} style={{ fontSize: 13 }}>
          <Icon name="Download" size={15} /> {exporting ? 'Exportando…' : 'Exportar'}
        </button>
        <button className="nb-btn nb-btn-primary" onClick={onNovo} style={{ fontSize: 13 }}>
          <Icon name="Plus" size={16} /> Novo lançamento
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* abas rápidas (sempre visíveis) */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => onAba(a.patch)}
            className={`nb-btn ${abaAtiva === a.id ? 'nb-btn-primary' : 'nb-btn-ghost'}`}
            style={{ padding: '8px 14px', fontSize: 13 }}>
            {a.label}
          </button>
        ))}
      </div>

      {/* topo mobile: rótulo do período + botão Filtros */}
      <div className="v2-filter-mob">
        <div style={{ minWidth: 0 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Período</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{periodoLabel}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="nb-btn nb-btn-primary" onClick={onNovo} style={{ padding: '9px 12px' }}><Icon name="Plus" size={16} /></button>
          <button className="nb-btn nb-btn-ghost" onClick={() => setOpen(true)}>
            <Icon name="Filter" size={16} /> Filtros
            {ativos > 0 && <span aria-hidden style={{ minWidth: 18, height: 18, borderRadius: 20, background: 'var(--nb-accent)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{ativos}</span>}
          </button>
        </div>
      </div>

      <div className={`v2-filter-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} />

      <div className={`v2-filterbar ${open ? 'is-open' : ''}`}>
        {controls}
        <button className="nb-btn nb-btn-primary v2-filter-apply" onClick={() => setOpen(false)} style={{ display: 'none' }}>
          Ver resultados
        </button>
      </div>
    </>
  );
}
