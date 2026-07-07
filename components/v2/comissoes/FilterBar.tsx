'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import Button from '@/components/v2/ui/Button';
import type { Filtros, Opt } from './types';

const PERIODOS: [string, string][] = [
  ['hoje', 'Hoje'], ['ontem', 'Ontem'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'],
  ['mes', 'Mês atual'], ['mes_anterior', 'Mês anterior'], ['ano', 'Ano atual'], ['custom', 'Personalizado'],
];
const SITUACOES: [string, string][] = [['todas', 'Todas'], ['pendente', 'Pendente'], ['parcial', 'Parcial'], ['pago', 'Pago']];
const FORMAS: [string, string][] = [['todas', 'Todas'], ['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['transferencia', 'Transferência'], ['outro', 'Outro']];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="v2-field"><label>{label}</label>{children}</div>;
}

export default function FilterBar({
  filtros, colaboradoras, onChange, onClear, onPagar, onExport, exporting,
}: {
  filtros: Filtros;
  colaboradoras: Opt[];
  onChange: (patch: Partial<Filtros>) => void;
  onClear: () => void;
  onPagar: () => void;
  onExport: () => void;
  exporting?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState(filtros.busca);
  const ativos = [
    filtros.periodo !== 'mes', filtros.profissional !== 'todos',
    filtros.situacao !== 'todas', filtros.forma !== 'todas', !!filtros.busca,
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
          <Field label="De"><input type="date" className="v2-select" style={{ paddingRight: 12 }} value={filtros.de || ''} onChange={(e) => onChange({ de: e.target.value })} /></Field>
          <Field label="Até"><input type="date" className="v2-select" style={{ paddingRight: 12 }} value={filtros.ate || ''} onChange={(e) => onChange({ ate: e.target.value })} /></Field>
        </>
      )}

      <Field label="Profissional">
        <select className="v2-select" value={filtros.profissional} onChange={(e) => onChange({ profissional: e.target.value })}>
          <option value="todos">Todas</option>
          {colaboradoras.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
        </select>
      </Field>

      <Field label="Situação">
        <select className="v2-select" value={filtros.situacao} onChange={(e) => onChange({ situacao: e.target.value })}>
          {SITUACOES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Forma do pagamento">
        <select className="v2-select" value={filtros.forma} onChange={(e) => onChange({ forma: e.target.value })}>
          {FORMAS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Field>

      <Field label="Buscar">
        <input className="v2-select" style={{ paddingRight: 12 }} placeholder="Nome ou função…" value={busca}
          onChange={(e) => { setBusca(e.target.value); onChange({ busca: e.target.value }); }} />
      </Field>

      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <button className="nb-btn nb-btn-quiet" onClick={() => { setBusca(''); onClear(); }} style={{ fontSize: 13 }}>
          <Icon name="RotateCcw" size={15} /> Limpar
        </button>
        <button className="nb-btn nb-btn-ghost" onClick={onExport} disabled={exporting} style={{ fontSize: 13 }}>
          <Icon name="Download" size={15} /> {exporting ? 'Exportando…' : 'Exportar'}
        </button>
        <Button icon="HandCoins" onClick={onPagar}>Registrar pagamento</Button>
      </div>
    </>
  );

  return (
    <>
      <div className="v2-filter-mob">
        <div style={{ minWidth: 0 }}>
          <div className="nb-eyebrow" style={{ fontSize: 9.5 }}>Filtros</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--nb-ink)' }}>{ativos > 0 ? `${ativos} ativo${ativos > 1 ? 's' : ''}` : 'Nenhum filtro'}</div>
        </div>
        <button className="nb-btn nb-btn-ghost" onClick={() => setOpen(true)}>
          <Icon name="Filter" size={16} /> Filtros
          {ativos > 0 && <span aria-hidden style={{ minWidth: 18, height: 18, borderRadius: 20, background: 'var(--nb-accent)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center', padding: '0 5px' }}>{ativos}</span>}
        </button>
      </div>

      <div className={`v2-filter-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} />
      <div className={`v2-filterbar ${open ? 'is-open' : ''}`}>{controls}</div>
    </>
  );
}
