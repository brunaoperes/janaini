'use client';

import { useState } from 'react';

export interface FiltrosLancamentos {
  dataInicio: string;
  dataFim: string;
  colaboradorId: string;
  clienteId: string;
  formaPagamento: string;
  buscaCliente: string;
}

interface FiltrosAvancadosProps {
  filtros: FiltrosLancamentos;
  onFiltrosChange: (filtros: FiltrosLancamentos) => void;
  colaboradores: Array<{ id: number; nome: string }>;
  clientes: Array<{ id: number; nome: string }>;
  formasPagamento: Array<{ value: string; label: string }>;
}

export default function FiltrosAvancados({
  filtros,
  onFiltrosChange,
  colaboradores,
  clientes,
  formasPagamento,
}: FiltrosAvancadosProps) {
  const [mostrarFiltros, setMostrarFiltros] = useState(false);

  function handleChange(campo: keyof FiltrosLancamentos, valor: string) {
    onFiltrosChange({ ...filtros, [campo]: valor });
  }

  function limparFiltros() {
    onFiltrosChange({
      dataInicio: '',
      dataFim: '',
      colaboradorId: '',
      clienteId: '',
      formaPagamento: '',
      buscaCliente: '',
    });
  }

  const filtrosAtivos = Object.values(filtros).filter((v) => v !== '').length;

  return (
    <div className="card-elevated mb-6">
      {/* Header do filtro */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setMostrarFiltros(!mostrarFiltros)}
          className="flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium transition-colors"
        >
          <span className="text-2xl">{mostrarFiltros ? '🔽' : '▶️'}</span>
          <span>Filtros Avançados</span>
          {filtrosAtivos > 0 && (
            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-bold">
              {filtrosAtivos}
            </span>
          )}
        </button>
        {filtrosAtivos > 0 && (
          <button
            onClick={limparFiltros}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Painel de filtros */}
      {mostrarFiltros && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          {/* Filtro por período */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Data Inicial
            </label>
            <input
              type="date"
              value={filtros.dataInicio}
              onChange={(e) => handleChange('dataInicio', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📅 Data Final
            </label>
            <input
              type="date"
              value={filtros.dataFim}
              onChange={(e) => handleChange('dataFim', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por colaboradora */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              👤 Colaboradora
            </label>
            <select
              value={filtros.colaboradorId}
              onChange={(e) => handleChange('colaboradorId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              {colaboradores.map((colab) => (
                <option key={colab.id} value={colab.id}>
                  {colab.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por forma de pagamento */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💳 Forma de Pagamento
            </label>
            <select
              value={filtros.formaPagamento}
              onChange={(e) => handleChange('formaPagamento', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todas</option>
              {formasPagamento.map((forma) => (
                <option key={forma.value} value={forma.value}>
                  {forma.label}
                </option>
              ))}
            </select>
          </div>

          {/* Busca por nome de cliente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              🔍 Buscar Cliente
            </label>
            <input
              type="text"
              value={filtros.buscaCliente}
              onChange={(e) => handleChange('buscaCliente', e.target.value)}
              placeholder="Digite o nome..."
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Filtro por cliente (select) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              💎 Cliente Específico
            </label>
            <select
              value={filtros.clienteId}
              onChange={(e) => handleChange('clienteId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Todos</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
