'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import type { Filtros, FaixaFiltro, StatusFiltro } from './types';

const STATUS: [StatusFiltro, string][] = [['todas', 'Todas'], ['ativas', 'Ativas'], ['inativas', 'Inativas']];
const FAIXAS: [FaixaFiltro, string][] = [['todas', 'Todas'], ['0-50', '0–50%'], ['51-70', '51–70%'], ['71-100', '71–100%'], ['100', '100%']];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="v2-field"><label>{label}</label>{children}</div>;
}

export default function FiltrosBar({ filtros, funcoes, total, mostrando, onChange, onClear }: {
  filtros: Filtros;
  funcoes: string[];
  total: number;
  mostrando: number;
  onChange: (patch: Partial<Filtros>) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ativos = [
    filtros.status !== 'todas',
    filtros.funcao !== 'todas',
    filtros.faixa !== 'todas',
    filtros.busca.trim() !== '',
  ].filter(Boolean).length;

  const controls = (
    <>
      <Field label="Status">
        <select className="v2-select" value={filtros.status} onChange={(e) => onChange({ status: e.target.value as StatusFiltro })}>
          {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Função">
        <select className="v2-select" value={filtros.funcao} onChange={(e) => onChange({ funcao: e.target.value })}>
          <option value="todas">Todas</option>
          {funcoes.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Field>

      <Field label="Faixa de comissão">
        <select className="v2-select" value={filtros.faixa} onChange={(e) => onChange({ faixa: e.target.value as FaixaFiltro })}>
          {FAIXAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Buscar">
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}><Icon name="Search" size={15} /></span>
          <input className="v2-select" style={{ paddingLeft: 32, paddingRight: 12, cursor: 'text', minWidth: 180 }} placeholder="Nome, função ou telefone"
            value={filtros.busca} onChange={(e) => onChange({ busca: e.target.value })} />
        </div>
      </Field>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--nb-ink-faint)', alignSelf: 'center' }} className="nb-num">
          {mostrando === total ? `${total} colaboradoras` : `${mostrando} de ${total}`}
        </span>
        <button className="nb-btn nb-btn-quiet" onClick={onClear} style={{ fontSize: 13 }} disabled={ativos === 0}>
          <Icon name="RotateCcw" size={15} /> Limpar
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="v2-filter-mob">
        <div style={{ minWidth: 0 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Equipe</div>
          <div className="nb-num" style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)' }}>{mostrando === total ? `${total} colaboradoras` : `${mostrando} de ${total}`}</div>
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
