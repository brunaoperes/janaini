'use client';

import { useState } from 'react';
import Icon from '@/components/v2/ui/Icon';
import { STATUS_META, StatusVis } from './timeline-utils';

export type FiltrosAgenda = {
  colaboradora: string; // 'todas' | id
  status: string;       // 'todos' | StatusVis
  servico: string;      // 'todos' | nome
  busca: string;
};

export const FILTROS_VAZIOS: FiltrosAgenda = { colaboradora: 'todas', status: 'todos', servico: 'todos', busca: '' };

export function temFiltroAtivo(f: FiltrosAgenda) {
  return f.colaboradora !== 'todas' || f.status !== 'todos' || f.servico !== 'todos' || f.busca.trim() !== '';
}

const STATUS_OPTS: StatusVis[] = ['pendente', 'confirmado', 'executando', 'concluido'];

export default function AgendaFilters({
  filtros, setFiltros, colabs, servicos, resultados,
}: {
  filtros: FiltrosAgenda;
  setFiltros: (f: FiltrosAgenda) => void;
  colabs: { id: number; nome: string }[];
  servicos: string[];
  resultados: number;
}) {
  const [aberto, setAberto] = useState(false);
  const set = (patch: Partial<FiltrosAgenda>) => setFiltros({ ...filtros, ...patch });
  const ativo = temFiltroAtivo(filtros);

  const campos = (
    <>
      <div className="v2-field">
        <label htmlFor="f-colab">Colaboradora</label>
        <select id="f-colab" className="v2-select" value={filtros.colaboradora} onChange={(e) => set({ colaboradora: e.target.value })}>
          <option value="todas">Todas</option>
          {colabs.map((c) => <option key={c.id} value={String(c.id)}>{c.nome}</option>)}
        </select>
      </div>

      <div className="v2-field">
        <label htmlFor="f-status">Status</label>
        <select id="f-status" className="v2-select" value={filtros.status} onChange={(e) => set({ status: e.target.value })}>
          <option value="todos">Todos</option>
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      <div className="v2-field">
        <label htmlFor="f-serv">Serviço</label>
        <select id="f-serv" className="v2-select" value={filtros.servico} onChange={(e) => set({ servico: e.target.value })}>
          <option value="todos">Todos</option>
          {servicos.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="v2-field" style={{ flex: '1 1 220px' }}>
        <label htmlFor="f-busca">Buscar</label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--nb-ink-faint)', pointerEvents: 'none' }}>
            <Icon name="Search" size={15} />
          </span>
          <input
            id="f-busca" className="nb-input" style={{ paddingLeft: 34 }}
            placeholder="Cliente, telefone ou serviço"
            value={filtros.busca} onChange={(e) => set({ busca: e.target.value })}
          />
        </div>
      </div>

      <button
        className="nb-btn nb-btn-ghost"
        onClick={() => setFiltros(FILTROS_VAZIOS)}
        disabled={!ativo}
        style={{ opacity: ativo ? 1 : 0.5 }}
      >
        <Icon name="RotateCcw" size={15} /> Limpar
      </button>

      <button className="nb-btn nb-btn-primary v2-filter-apply" style={{ display: 'none' }} onClick={() => setAberto(false)}>
        Ver {resultados} agendamento{resultados === 1 ? '' : 's'}
      </button>
    </>
  );

  return (
    <>
      {/* Gatilho mobile */}
      <div className="v2-filter-mob">
        <button className="nb-btn nb-btn-ghost" onClick={() => setAberto(true)} style={{ position: 'relative' }}>
          <Icon name="Filter" size={16} /> Filtros
          {ativo && <span style={{ position: 'absolute', top: 6, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--nb-accent)' }} />}
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--nb-ink-faint)' }}>{resultados} no dia</span>
      </div>

      <div className={`v2-filter-backdrop ${aberto ? 'is-open' : ''}`} onClick={() => setAberto(false)} />

      <div className={`v2-filterbar ${aberto ? 'is-open' : ''}`}>
        {campos}
      </div>
    </>
  );
}
