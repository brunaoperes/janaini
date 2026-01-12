'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Lancamento {
  id: number;
  data: string;
  servicos: string;
  cliente: string;
  valor_servico: number;
  comissao_bruta: number;
  forma_pagamento: string;
  taxa_aplicada: number;
  desconto: number;
  comissao_liquida: number;
}

interface Comissao {
  colaborador_id: number;
  colaborador_nome: string;
  total_servicos: number;
  total_bruto: number;
  total_descontos: number;
  total_liquido: number;
  lancamentos: Lancamento[];
}

interface Historico {
  id: number;
  colaborador_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  valor_bruto: number;
  total_descontos: number;
  valor_liquido: number;
  forma_pagamento_comissao: string;
  observacoes: string;
  pago_em: string;
  colaborador?: { nome: string };
  admin?: { nome: string };
}

interface Colaborador {
  id: number;
  nome: string;
  porcentagem_comissao: number;
}

export default function ComissoesPage() {
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userColaboradorId, setUserColaboradorId] = useState<number | null>(null);

  // Filtros
  const hoje = new Date();
  const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);

  const [dataInicio, setDataInicio] = useState(format(primeiroDiaMes, 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(ultimoDiaMes, 'yyyy-MM-dd'));
  const [colaboradorFiltro, setColaboradorFiltro] = useState('todos');

  // Modais
  const [showDetalhes, setShowDetalhes] = useState<Comissao | null>(null);
  const [showHistorico, setShowHistorico] = useState(false);
  const [showPagamento, setShowPagamento] = useState<Comissao | null>(null);
  const [pagamentoData, setPagamentoData] = useState({
    forma_pagamento: 'pix',
    observacoes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [dataInicio, dataFim, colaboradorFiltro]);

  async function loadData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        dataInicio,
        dataFim,
        colaboradorId: colaboradorFiltro,
      });

      const response = await fetch(`/api/comissoes?${params}`, {
        cache: 'no-store',
      });

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setComissoes(data.comissoes || []);
      setHistorico(data.historico || []);
      setColaboradores(data.colaboradores || []);
      setIsAdmin(data._userProfile?.isAdmin || false);
      setUserColaboradorId(data._userProfile?.colaboradorId || null);
    } catch (error) {
      console.error('Erro ao carregar comissões:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  // Funções de período rápido
  function setMesAtual() {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    setDataInicio(format(primeiro, 'yyyy-MM-dd'));
    setDataFim(format(ultimo, 'yyyy-MM-dd'));
  }

  function setMesAnterior() {
    const hoje = new Date();
    const primeiro = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const ultimo = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    setDataInicio(format(primeiro, 'yyyy-MM-dd'));
    setDataFim(format(ultimo, 'yyyy-MM-dd'));
  }

  function setSemanaAtual() {
    const hoje = new Date();
    const diaSemana = hoje.getDay();
    const primeiro = new Date(hoje);
    primeiro.setDate(hoje.getDate() - diaSemana);
    const ultimo = new Date(primeiro);
    ultimo.setDate(primeiro.getDate() + 6);
    setDataInicio(format(primeiro, 'yyyy-MM-dd'));
    setDataFim(format(ultimo, 'yyyy-MM-dd'));
  }

  // Registrar pagamento
  async function handlePagar() {
    if (!showPagamento) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/comissoes/pagar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaborador_id: showPagamento.colaborador_id,
          periodo_inicio: dataInicio,
          periodo_fim: dataFim,
          valor_bruto: showPagamento.total_bruto,
          total_descontos: showPagamento.total_descontos,
          valor_liquido: showPagamento.total_liquido,
          forma_pagamento_comissao: pagamentoData.forma_pagamento,
          observacoes: pagamentoData.observacoes,
          lancamentos_ids: showPagamento.lancamentos.map(l => l.id),
          detalhes_calculo: {
            lancamentos: showPagamento.lancamentos,
            periodo: { inicio: dataInicio, fim: dataFim },
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Erro ao registrar pagamento');
        return;
      }

      toast.success('Pagamento registrado com sucesso!');
      setShowPagamento(null);
      setPagamentoData({ forma_pagamento: 'pix', observacoes: '' });
      loadData();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao registrar pagamento');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Calcular totais gerais
  const totalGeral = comissoes.reduce((acc, c) => ({
    bruto: acc.bruto + c.total_bruto,
    descontos: acc.descontos + c.total_descontos,
    liquido: acc.liquido + c.total_liquido,
    servicos: acc.servicos + c.total_servicos,
  }), { bruto: 0, descontos: 0, liquido: 0, servicos: 0 });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          <p className="mt-4 text-gray-600">Carregando comissões...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-purple-100">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-purple-600 hover:text-purple-700">
                ← Voltar
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Comissões</h1>
                <p className="text-sm text-gray-500">
                  {format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })} - {format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowHistorico(true)}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-xl font-medium hover:bg-purple-200 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ver Histórico de Pagamentos
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6">
        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg p-4 md:p-6 mb-6">
          <h3 className="text-sm font-semibold text-gray-600 mb-4">Filtros</h3>

          {/* Botões de período rápido */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={setSemanaAtual}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Semana atual
            </button>
            <button
              onClick={setMesAtual}
              className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              Mês atual
            </button>
            <button
              onClick={setMesAnterior}
              className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Mês anterior
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Início</label>
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                <select
                  value={colaboradorFiltro}
                  onChange={(e) => setColaboradorFiltro(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500"
                >
                  <option value="todos">Todos</option>
                  {colaboradores.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Resumo Geral (Admin) */}
        {isAdmin && comissoes.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-sm text-gray-500">Total Serviços</p>
              <p className="text-2xl font-bold text-gray-800">{totalGeral.servicos}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-sm text-gray-500">Comissão Bruta</p>
              <p className="text-2xl font-bold text-blue-600">R$ {totalGeral.bruto.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-sm text-gray-500">Descontos (Taxas)</p>
              <p className="text-2xl font-bold text-red-600">- R$ {totalGeral.descontos.toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl shadow-lg p-4">
              <p className="text-sm text-gray-500">Total a Pagar</p>
              <p className="text-2xl font-bold text-green-600">R$ {totalGeral.liquido.toFixed(2)}</p>
            </div>
          </div>
        )}

        {/* Lista de Comissões por Colaborador */}
        <div className="space-y-4">
          {comissoes.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <p className="text-gray-500">Nenhuma comissão pendente no período selecionado.</p>
            </div>
          ) : (
            comissoes.map(comissao => (
              <div key={comissao.colaborador_id} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                {/* Header do Card */}
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-4">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <h3 className="text-xl font-bold text-white">{comissao.colaborador_nome}</h3>
                      <p className="text-white/80 text-sm">{comissao.total_servicos} serviços realizados</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/80 text-sm">Comissão Líquida</p>
                      <p className="text-2xl font-bold text-white">R$ {comissao.total_liquido.toFixed(2)}</p>
                    </div>
                  </div>
                </div>

                {/* Detalhes */}
                <div className="p-6">
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Bruto</p>
                      <p className="text-lg font-semibold text-blue-600">R$ {comissao.total_bruto.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Descontos</p>
                      <p className="text-lg font-semibold text-red-600">- R$ {comissao.total_descontos.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-gray-500">Líquido</p>
                      <p className="text-lg font-semibold text-green-600">R$ {comissao.total_liquido.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      onClick={() => setShowDetalhes(comissao)}
                      className="flex-1 px-4 py-2 bg-purple-50 text-purple-600 rounded-xl font-medium hover:bg-purple-100 transition-colors"
                    >
                      Ver Detalhes
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setShowPagamento(comissao)}
                        className="flex-1 px-4 py-2 bg-green-500 text-white rounded-xl font-medium hover:bg-green-600 transition-colors"
                      >
                        Marcar como Paga
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {showDetalhes && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetalhes(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">Detalhes - {showDetalhes.colaborador_nome}</h3>
                  <p className="text-white/80 text-sm">{showDetalhes.total_servicos} lançamentos</p>
                </div>
                <button
                  onClick={() => setShowDetalhes(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Data</th>
                    <th className="px-3 py-2 text-left">Serviço</th>
                    <th className="px-3 py-2 text-right">Valor</th>
                    <th className="px-3 py-2 text-right">Comissão</th>
                    <th className="px-3 py-2 text-center">Pagto</th>
                    <th className="px-3 py-2 text-right">Taxa</th>
                    <th className="px-3 py-2 text-right">Líquido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {showDetalhes.lancamentos.map(lanc => (
                    <tr key={lanc.id} className="hover:bg-purple-50">
                      <td className="px-3 py-2">{format(new Date(lanc.data), 'dd/MM')}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate">{lanc.servicos}</td>
                      <td className="px-3 py-2 text-right">R$ {lanc.valor_servico.toFixed(2)}</td>
                      <td className="px-3 py-2 text-right text-blue-600">R$ {lanc.comissao_bruta.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          lanc.forma_pagamento === 'pix' || lanc.forma_pagamento === 'dinheiro'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {lanc.forma_pagamento}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-red-600">
                        {lanc.desconto > 0 ? `-R$ ${lanc.desconto.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-green-600">
                        R$ {lanc.comissao_liquida.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold">
                  <tr>
                    <td colSpan={3} className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right text-blue-600">R$ {showDetalhes.total_bruto.toFixed(2)}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right text-red-600">
                      -R$ {showDetalhes.total_descontos.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right text-green-600">
                      R$ {showDetalhes.total_liquido.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Pagamento */}
      {showPagamento && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPagamento(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-6 py-5 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Confirmar Pagamento</h3>
                <button
                  onClick={() => setShowPagamento(null)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500">Colaborador</p>
                <p className="text-xl font-bold text-gray-800">{showPagamento.colaborador_nome}</p>
              </div>

              <div className="bg-green-50 rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">Valor a Pagar</p>
                <p className="text-3xl font-bold text-green-600">
                  R$ {showPagamento.total_liquido.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {showPagamento.total_servicos} lançamentos | {format(new Date(dataInicio), 'dd/MM')} - {format(new Date(dataFim), 'dd/MM')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Como foi pago?
                </label>
                <select
                  value={pagamentoData.forma_pagamento}
                  onChange={(e) => setPagamentoData(prev => ({ ...prev, forma_pagamento: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500"
                >
                  <option value="pix">PIX</option>
                  <option value="dinheiro">Dinheiro</option>
                  <option value="transferencia">Transferência Bancária</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Observações (opcional)
                </label>
                <textarea
                  value={pagamentoData.observacoes}
                  onChange={(e) => setPagamentoData(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 resize-none"
                  rows={2}
                  placeholder="Ex: Pago via PIX Nubank"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPagamento(null)}
                  className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePagar}
                  disabled={isSubmitting}
                  className="flex-1 px-6 py-3 bg-green-500 text-white rounded-xl font-semibold hover:bg-green-600 disabled:opacity-50"
                >
                  {isSubmitting ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Histórico */}
      {showHistorico && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowHistorico(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Histórico de Pagamentos</h3>
                <button
                  onClick={() => setShowHistorico(false)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {historico.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhum pagamento registrado ainda.</p>
              ) : (
                <div className="space-y-4">
                  {historico.map(h => (
                    <div key={h.id} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                        <div>
                          <p className="font-semibold text-gray-800">{h.colaborador?.nome}</p>
                          <p className="text-sm text-gray-500">
                            Período: {format(new Date(h.periodo_inicio), 'dd/MM/yyyy')} - {format(new Date(h.periodo_fim), 'dd/MM/yyyy')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-green-600">R$ {h.valor_liquido.toFixed(2)}</p>
                          <p className="text-xs text-gray-500">
                            Pago em {format(new Date(h.pago_em), "dd/MM/yyyy 'às' HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                          Bruto: R$ {h.valor_bruto.toFixed(2)}
                        </span>
                        {h.total_descontos > 0 && (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full">
                            Descontos: R$ {h.total_descontos.toFixed(2)}
                          </span>
                        )}
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                          Via: {h.forma_pagamento_comissao}
                        </span>
                        {h.admin?.nome && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                            Por: {h.admin.nome}
                          </span>
                        )}
                      </div>
                      {h.observacoes && (
                        <p className="text-sm text-gray-600 mt-2 italic">"{h.observacoes}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
