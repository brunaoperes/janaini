'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { ORDENACOES, type Filtros } from './_shared';

const STATUS: [string, string][] = [['todos', 'Todos'], ['ativos', 'Ativos'], ['inativos', 'Inativos']];
const EXCLUS: [string, string][] = [['todos', 'Todas'], ['geral', 'Geral'], ['exclusivo', 'Exclusivo']];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="v2-field"><label>{label}</label>{children}</div>;
}

export default function FilterBar({
  filtros, temFiltro, onChange, onClear, onExport, onNovo, exporting,
}: {
  filtros: Filtros;
  temFiltro: boolean;
  onChange: (patch: Partial<Filtros>) => void;
  onClear: () => void;
  onExport: () => void;
  onNovo: () => void;
  exporting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ativos = [
    filtros.status !== 'todos', filtros.exclusividade !== 'todos', filtros.busca.trim() !== '',
    filtros.precoMin !== '' || filtros.precoMax !== '', filtros.duracaoMin !== '' || filtros.duracaoMax !== '',
  ].filter(Boolean).length;

  const controls = (
    <>
      <Field label="Buscar">
        <div style={{ position: 'relative', minWidth: 0 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}>
            <Icon name="Search" size={15} />
          </span>
          <input
            className="v2-select" style={{ paddingLeft: 32, paddingRight: 12, cursor: 'text', minWidth: 190 }}
            placeholder="Nome ou descrição…" value={filtros.busca}
            onChange={(e) => onChange({ busca: e.target.value })}
          />
        </div>
      </Field>

      <Field label="Status">
        <select className="v2-select" value={filtros.status} onChange={(e) => onChange({ status: e.target.value as Filtros['status'] })}>
          {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Exclusividade">
        <select className="v2-select" value={filtros.exclusividade} onChange={(e) => onChange({ exclusividade: e.target.value as Filtros['exclusividade'] })}>
          {EXCLUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Preço (R$)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="v2-select nb-num" type="number" min={0} placeholder="mín" style={{ width: 84, paddingRight: 10 }} value={filtros.precoMin} onChange={(e) => onChange({ precoMin: e.target.value })} />
          <span style={{ color: 'var(--nb-ink-faint)' }}>–</span>
          <input className="v2-select nb-num" type="number" min={0} placeholder="máx" style={{ width: 84, paddingRight: 10 }} value={filtros.precoMax} onChange={(e) => onChange({ precoMax: e.target.value })} />
        </div>
      </Field>

      <Field label="Duração (min)">
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input className="v2-select nb-num" type="number" min={0} placeholder="mín" style={{ width: 78, paddingRight: 10 }} value={filtros.duracaoMin} onChange={(e) => onChange({ duracaoMin: e.target.value })} />
          <span style={{ color: 'var(--nb-ink-faint)' }}>–</span>
          <input className="v2-select nb-num" type="number" min={0} placeholder="máx" style={{ width: 78, paddingRight: 10 }} value={filtros.duracaoMax} onChange={(e) => onChange({ duracaoMax: e.target.value })} />
        </div>
      </Field>

      <Field label="Ordenar por">
        <select className="v2-select" value={filtros.ordenar} onChange={(e) => onChange({ ordenar: e.target.value })}>
          {ORDENACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
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
          <Icon name="Plus" size={16} /> Novo serviço
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* topo mobile: resumo + botão Filtros */}
      <div className="v2-filter-mob">
        <div style={{ minWidth: 0 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Catálogo</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)' }}>Serviços</div>
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
