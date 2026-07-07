'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import type { Filtros } from './_shared';

const PERIODOS: [string, string][] = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'],
  ['mes', 'Mês atual'], ['mes_anterior', 'Mês anterior'], ['ano', 'Ano atual'], ['custom', 'Personalizado'],
];
const FORMAS: [string, string][] = [
  ['todas', 'Todas'], ['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['cartao_debito', 'Débito'],
  ['cartao_credito', 'Crédito'], ['fiado', 'Fiado'], ['outros', 'Outros'],
];

type Opt = { id: number | string; nome: string };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="v2-field"><label>{label}</label>{children}</div>;
}

export default function FilterBar({
  filtros, periodoLabel, colaboradoras, servicos, onChange, onClear, onExport, exporting,
}: {
  filtros: Filtros;
  periodoLabel: string;
  colaboradoras: Opt[];
  servicos: Opt[];
  onChange: (patch: Partial<Filtros>) => void;
  onClear: () => void;
  onExport: () => void;
  exporting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ativos = [
    filtros.colaborador !== 'todos',
    filtros.servico !== 'todos',
    filtros.forma !== 'todas',
    filtros.periodo !== 'mes',
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

      <Field label="Colaboradora">
        <select className="v2-select" value={filtros.colaborador} onChange={(e) => onChange({ colaborador: e.target.value })}>
          <option value="todos">Todas</option>
          {colaboradoras.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
        </select>
      </Field>

      <Field label="Serviço">
        <select className="v2-select" value={filtros.servico} onChange={(e) => onChange({ servico: e.target.value })}>
          <option value="todos">Todos</option>
          {servicos.map((s) => <option key={s.id} value={String(s.id)}>{s.nome}</option>)}
        </select>
      </Field>

      <Field label="Pagamento">
        <select className="v2-select" value={filtros.forma} onChange={(e) => onChange({ forma: e.target.value })}>
          {FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <button className="nb-btn nb-btn-quiet" onClick={onClear} style={{ fontSize: 13 }}>
          <Icon name="RotateCcw" size={15} /> Limpar
        </button>
        <button className="nb-btn nb-btn-ghost" onClick={onExport} disabled={exporting} style={{ fontSize: 13 }}>
          <Icon name="Download" size={15} /> {exporting ? 'Exportando…' : 'Exportar relatório'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* topo mobile: rótulo do período + botão Filtros */}
      <div className="v2-filter-mob">
        <div style={{ minWidth: 0 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Período</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{periodoLabel}</div>
        </div>
        <button className="nb-btn nb-btn-ghost" onClick={() => setOpen(true)}>
          <Icon name="Filter" size={16} /> Filtros
          {ativos > 0 && <span aria-hidden style={{ minWidth: 18, height: 18, borderRadius: 20, background: 'var(--nb-accent)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{ativos}</span>}
        </button>
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
