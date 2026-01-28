'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import FaturamentoChart from '@/components/FaturamentoChart';
import Header from '@/components/Header';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

interface Lancamento {
  id: number;
  valor_total: number;
  forma_pagamento: string;
  servicos_nomes: string;
  data: string;
  clientes: { nome: string } | null;
  colaboradores: { nome: string } | null;
}

interface Colaborador {
  id: number;
  nome: string;
}

interface DashboardData {
  totalDia: number;
  totalMes: number;
  totalClientes: number;
  agendamentosHoje: number;
  topColaboradoras: { nome: string; total: number }[];
  topClientes: { id: number; nome: string; visitas: number; total: number }[];
  proximosAgendamentos: any[];
  chartData: { data: string; valor: number }[];
  lancamentosHoje: Lancamento[];
  lancamentosMes: Lancamento[];
  totalPeriodoGrafico: number;
  // Info de permissões
  isAdmin: boolean;
  colaboradorId: string | null;
  colaboradorIdFiltro: string | null;
  colaboradores: Colaborador[];
}

type PeriodoGrafico = '7' | '30' | '90' | 'personalizado' | 'todos';

interface ClienteDetalhes {
  id: number;
  nome: string;
  telefone: string;
  aniversario: string;
}

export default function Dashboard() {
  const { profile, isAdmin, loading: authLoading } = useAuth();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clienteSelecionado, setClienteSelecionado] = useState<ClienteDetalhes | null>(null);
  const [loadingCliente, setLoadingCliente] = useState(false);
  const [modalHoje, setModalHoje] = useState(false);
  const [modalMes, setModalMes] = useState(false);

  // Estado do filtro do gráfico
  const [periodoGrafico, setPeriodoGrafico] = useState<PeriodoGrafico>('30');
  const [dataInicioGrafico, setDataInicioGrafico] = useState('');
  const [dataFimGrafico, setDataFimGrafico] = useState('');
  const [loadingGrafico, setLoadingGrafico] = useState(false);

  // Filtro por colaborador (apenas para admin)
  const [colaboradorFiltro, setColaboradorFiltro] = useState<string>('');

  // Função para buscar detalhes do cliente
  const buscarDetalhesCliente = async (clienteId: number) => {
    setLoadingCliente(true);
    try {
      const response = await fetch(`/api/cliente/${clienteId}`);
      if (!response.ok) {
        throw new Error('Erro ao buscar cliente');
      }
      const cliente = await response.json();
      setClienteSelecionado(cliente);
    } catch (err) {
      console.error('Erro ao buscar cliente:', err);
      alert('Erro ao carregar dados do cliente');
    } finally {
      setLoadingCliente(false);
    }
  };

  // Função para formatar telefone para WhatsApp
  const formatarWhatsApp = (telefone: string) => {
    if (!telefone) return null;
    // Remove tudo que não é número
    const numeros = telefone.replace(/\D/g, '');
    // Se já tem o 55, usa direto, senão adiciona
    const numeroCompleto = numeros.startsWith('55') ? numeros : `55${numeros}`;
    return `https://wa.me/${numeroCompleto}`;
  };

  // Função para formatar data de aniversário
  const formatarAniversario = (data: string) => {
    if (!data) return 'Não informado';
    try {
      const date = new Date(data + 'T00:00:00');
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
    } catch {
      return data;
    }
  };

  // Função para formatar data completa
  const formatarDataCompleta = (data: string) => {
    if (!data) return '';
    try {
      const date = new Date(data);
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch {
      return data;
    }
  };

  // Função para formatar hora
  const formatarHora = (data: string) => {
    if (!data) return '';
    try {
      const date = new Date(data);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Função para carregar dados do dashboard
  const loadData = useCallback(async (dias?: string, dataInicio?: string, dataFim?: string, colaboradorId?: string) => {
    try {
      let url = '/api/dashboard';
      const params = new URLSearchParams();

      if (dataInicio && dataFim) {
        params.append('dataInicio', dataInicio);
        params.append('dataFim', dataFim);
      } else if (dias) {
        params.append('dias', dias);
      }

      // Filtro por colaborador (apenas admin pode usar)
      if (colaboradorId) {
        params.append('colaboradorId', colaboradorId);
      }

      if (params.toString()) {
        url += '?' + params.toString();
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Erro ao carregar dados');
      }
      const result = await response.json();
      setData(result);
    } catch (err: any) {
      console.error('Erro ao carregar dashboard:', err);
      setError(err.message);
    }
  }, []);

  // Função para atualizar o gráfico com novo período
  const atualizarGrafico = useCallback(async () => {
    setLoadingGrafico(true);
    try {
      if (periodoGrafico === 'personalizado') {
        if (!dataInicioGrafico || !dataFimGrafico) {
          alert('Selecione as datas de início e fim');
          return;
        }
        await loadData(undefined, dataInicioGrafico, dataFimGrafico, colaboradorFiltro || undefined);
      } else if (periodoGrafico === 'todos') {
        await loadData('3650', undefined, undefined, colaboradorFiltro || undefined); // ~10 anos para pegar todo o período
      } else {
        await loadData(periodoGrafico, undefined, undefined, colaboradorFiltro || undefined);
      }
    } finally {
      setLoadingGrafico(false);
    }
  }, [periodoGrafico, dataInicioGrafico, dataFimGrafico, colaboradorFiltro, loadData]);

  // Carregar dados iniciais (aguardar auth)
  useEffect(() => {
    async function init() {
      // Esperar auth carregar
      if (authLoading) return;

      await loadData('30', undefined, undefined, colaboradorFiltro || undefined);
      setLoading(false);
    }
    init();
  }, [authLoading, loadData, colaboradorFiltro]);

  // Atualizar quando filtro de colaborador mudar (apenas admin)
  useEffect(() => {
    if (!loading && !authLoading && isAdmin) {
      loadData(periodoGrafico === 'todos' ? '3650' : periodoGrafico, undefined, undefined, colaboradorFiltro || undefined);
    }
  }, [colaboradorFiltro]);

  // Atualizar gráfico quando período mudar (exceto personalizado)
  useEffect(() => {
    if (periodoGrafico !== 'personalizado' && !loading && !authLoading) {
      atualizarGrafico();
    }
  }, [periodoGrafico, atualizarGrafico, loading, authLoading]);

  if (loading || authLoading) {
    return (
      <>
        <Header />
        <LoadingSpinner />
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-500 mb-4">Erro ao carregar dados: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="min-h-screen">
        <div className="container-main">
        {/* Header */}
        <div className="page-header">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold mb-2">
                <span className="text-gradient">
                  {data?.isAdmin ? 'Dashboard' : 'Meus Resultados'}
                </span>
              </h1>
              <p className="text-gray-600 text-lg">
                {data?.isAdmin
                  ? (colaboradorFiltro ? `Filtrando por colaborador` : 'Visão geral do salão')
                  : `Olá, ${profile?.nome || 'Colaborador'}!`
                }
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Filtro por colaborador - apenas para admin */}
              {data?.isAdmin && data.colaboradores && data.colaboradores.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600 whitespace-nowrap">
                    Colaborador:
                  </label>
                  <select
                    value={colaboradorFiltro}
                    onChange={(e) => setColaboradorFiltro(e.target.value)}
                    className="px-3 py-2 border border-purple-200 rounded-xl bg-white/80 backdrop-blur text-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-400 min-w-[180px]"
                  >
                    <option value="">Todos</option>
                    {data.colaboradores.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="text-6xl animate-float">📊</div>
            </div>
          </div>
          <div className="divider-gradient"></div>
        </div>

        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Card Faturamento do Dia - Clicável */}
          <button
            onClick={() => setModalHoje(true)}
            className="card-elevated bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 hover:scale-105 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium mb-1">Hoje</p>
                <p className="text-3xl font-bold text-green-700">
                  R$ {data.totalDia.toFixed(2)}
                </p>
              </div>
              <div className="w-14 h-14 bg-green-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                💰
              </div>
            </div>
          </button>

          {/* Card Faturamento do Mês - Clicável */}
          <button
            onClick={() => setModalMes(true)}
            className="card-elevated bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 hover:scale-105 hover:shadow-xl transition-all cursor-pointer text-left"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-600 text-sm font-medium mb-1">Este Mês</p>
                <p className="text-3xl font-bold text-purple-700">
                  R$ {data.totalMes.toFixed(2)}
                </p>
              </div>
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📈
              </div>
            </div>
          </button>

          {/* Card Total de Clientes - Link */}
          <Link
            href="/admin/clientes"
            className="card-elevated bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200 hover:scale-105 hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium mb-1">Clientes</p>
                <p className="text-3xl font-bold text-blue-700">
                  {data.totalClientes}
                </p>
              </div>
              <div className="w-14 h-14 bg-blue-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                👥
              </div>
            </div>
          </Link>

          {/* Card Agendamentos Hoje - Link */}
          <Link
            href="/agenda"
            className="card-elevated bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200 hover:scale-105 hover:shadow-xl transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-600 text-sm font-medium mb-1">Agendamentos Hoje</p>
                <p className="text-3xl font-bold text-orange-700">
                  {data.agendamentosHoje}
                </p>
              </div>
              <div className="w-14 h-14 bg-orange-500 rounded-2xl flex items-center justify-center text-3xl shadow-lg">
                📅
              </div>
            </div>
          </Link>
        </div>

        {/* Gráfico de Faturamento */}
        <div className="card-elevated mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <span className="text-3xl">📊</span>
              Faturamento
              {data.totalPeriodoGrafico > 0 && (
                <span className="text-purple-600 text-lg font-normal ml-2">
                  (R$ {data.totalPeriodoGrafico.toFixed(2)})
                </span>
              )}
            </h2>

            {/* Filtro de Período */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setPeriodoGrafico('7')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodoGrafico === '7'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  7 dias
                </button>
                <button
                  onClick={() => setPeriodoGrafico('30')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodoGrafico === '30'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  30 dias
                </button>
                <button
                  onClick={() => setPeriodoGrafico('90')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodoGrafico === '90'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  90 dias
                </button>
                <button
                  onClick={() => setPeriodoGrafico('personalizado')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodoGrafico === 'personalizado'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  Personalizado
                </button>
                <button
                  onClick={() => setPeriodoGrafico('todos')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    periodoGrafico === 'todos'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  Todo Período
                </button>
              </div>

              {/* Campos de data personalizada */}
              {periodoGrafico === 'personalizado' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={dataInicioGrafico}
                    onChange={(e) => setDataInicioGrafico(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <span className="text-gray-500">até</span>
                  <input
                    type="date"
                    value={dataFimGrafico}
                    onChange={(e) => setDataFimGrafico(e.target.value)}
                    className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  />
                  <button
                    onClick={atualizarGrafico}
                    disabled={loadingGrafico}
                    className="px-4 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {loadingGrafico ? 'Carregando...' : 'Aplicar'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Loading do gráfico */}
          {loadingGrafico ? (
            <div className="h-80 flex items-center justify-center">
              <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <FaturamentoChart data={data.chartData} />
          )}
        </div>

        {/* Grid com Rankings e Agendamentos */}
        <div className={`grid grid-cols-1 ${data?.isAdmin && !colaboradorFiltro ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-6 mb-8`}>
          {/* Top 5 Colaboradoras - Apenas para admin sem filtro */}
          {data?.isAdmin && !colaboradorFiltro && (
            <div className="card-elevated">
              <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="text-2xl">🏆</span>
                Top Colaboradoras
              </h3>
              <div className="space-y-3">
                {data.topColaboradoras.length > 0 ? (
                  data.topColaboradoras.map((colab, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                          ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-purple-400'}
                        `}>
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-800">{colab.nome}</span>
                      </div>
                      <span className="font-bold text-purple-600">
                        R$ {colab.total.toFixed(2)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
                )}
              </div>
            </div>
          )}

          {/* Top 10 Clientes */}
          <div className="card-elevated">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">💎</span>
              {data?.isAdmin && !colaboradorFiltro ? 'Top Clientes' : 'Meus Top Clientes'}
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.topClientes.length > 0 ? (
                data.topClientes.map((cliente, index) => (
                  <button
                    key={index}
                    onClick={() => buscarDetalhesCliente(cliente.id)}
                    className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-100 hover:shadow-md hover:scale-[1.02] transition-all cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm
                        ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-orange-500' : 'bg-blue-400'}
                      `}>
                        {index + 1}
                      </div>
                      <div>
                        <span className="font-medium text-gray-800 block">{cliente.nome}</span>
                        <span className="text-xs text-gray-500">{cliente.visitas} visitas</span>
                      </div>
                    </div>
                    <span className="font-bold text-blue-600">
                      R$ {cliente.total.toFixed(2)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum dado disponível</p>
              )}
            </div>
          </div>

          {/* Próximos Agendamentos */}
          <div className="card-elevated">
            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <span className="text-2xl">⏰</span>
              {data?.isAdmin && !colaboradorFiltro ? 'Próximos Agendamentos' : 'Meus Próximos Agendamentos'}
            </h3>
            <div className="space-y-3">
              {data.proximosAgendamentos.length > 0 ? (
                data.proximosAgendamentos.map((agend: any) => {
                  const dataHora = new Date(agend.data_hora);
                  const hora = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                  return (
                    <div
                      key={agend.id}
                      className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-100 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-orange-600">{hora}</span>
                        <span className="text-xs text-gray-500">{agend.duracao_minutos}min</span>
                      </div>
                      <p className="font-medium text-gray-800">{agend.clientes?.nome}</p>
                      <p className="text-sm text-gray-600">{agend.colaboradores?.nome}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-8">Nenhum agendamento hoje</p>
              )}
            </div>
          </div>
        </div>

        {/* Links Rápidos */}
        <div className={`grid ${data?.isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
          <Link
            href="/lancamentos"
            className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-3">💰</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
              {data?.isAdmin ? 'Lançamentos' : 'Meus Lançamentos'}
            </h3>
            <p className="text-gray-600 text-sm">
              {data?.isAdmin ? 'Ver todos os lançamentos' : 'Ver meus lançamentos'}
            </p>
          </Link>

          {/* Administração - apenas para admin */}
          {data?.isAdmin && (
            <Link
              href="/admin"
              className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
            >
              <div className="text-4xl mb-3">⚙️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
                Administração
              </h3>
              <p className="text-gray-600 text-sm">Gerenciar sistema</p>
            </Link>
          )}

          <Link
            href="/agenda"
            className="card-elevated card-highlight text-center group hover:scale-105 transition-transform"
          >
            <div className="text-4xl mb-3">📅</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gradient">
              {data?.isAdmin ? 'Agenda' : 'Minha Agenda'}
            </h3>
            <p className="text-gray-600 text-sm">
              {data?.isAdmin ? 'Ver agenda completa' : 'Ver minha agenda'}
            </p>
          </Link>
        </div>
        </div>
      </div>

      {/* Modal de Detalhes do Cliente */}
      {clienteSelecionado && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setClienteSelecionado(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 p-6 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-4xl">
                    👤
                  </div>
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">{clienteSelecionado.nome}</h2>
                    <p className="text-blue-100 text-sm">Detalhes do Cliente</p>
                  </div>
                </div>
                <button
                  onClick={() => setClienteSelecionado(null)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Conteúdo */}
            <div className="p-6 space-y-4">
              {/* Telefone/WhatsApp */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
                <label className="text-xs font-bold text-green-600 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Telefone
                </label>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xl font-bold text-gray-800">
                    {clienteSelecionado.telefone || 'Não informado'}
                  </span>
                  {clienteSelecionado.telefone && formatarWhatsApp(clienteSelecionado.telefone) && (
                    <a
                      href={formatarWhatsApp(clienteSelecionado.telefone)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Aniversário */}
              <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-4 border border-pink-200">
                <label className="text-xs font-bold text-pink-600 uppercase tracking-wide flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z" />
                  </svg>
                  Aniversário
                </label>
                <div className="mt-2 text-xl font-bold text-gray-800">
                  {formatarAniversario(clienteSelecionado.aniversario)}
                </div>
              </div>

              {/* Botão Fechar */}
              <button
                onClick={() => setClienteSelecionado(null)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading do cliente */}
      {loadingCliente && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-xl">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-3 text-gray-600">Carregando...</p>
          </div>
        </div>
      )}

      {/* Modal Entradas de Hoje */}
      {modalHoje && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalHoje(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-green-500 to-emerald-500 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl">
                    💰
                  </div>
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">Entradas de Hoje</h2>
                    <p className="text-green-100 text-sm">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalHoje(false)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div className="p-4 bg-green-50 border-b border-green-200">
              <div className="flex justify-between items-center">
                <span className="text-green-700 font-medium">Total do dia:</span>
                <span className="text-2xl font-bold text-green-700">R$ {data.totalDia.toFixed(2)}</span>
              </div>
              <span className="text-sm text-green-600">{data.lancamentosHoje.length} lançamento(s)</span>
            </div>

            {/* Lista de Lançamentos */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {data.lancamentosHoje.length > 0 ? (
                <div className="space-y-3">
                  {data.lancamentosHoje.map((lanc) => (
                    <div
                      key={lanc.id}
                      className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800">{lanc.clientes?.nome || 'Cliente não informado'}</p>
                          <p className="text-sm text-gray-600">{lanc.colaboradores?.nome}</p>
                        </div>
                        <span className="font-bold text-green-600 text-lg">R$ {lanc.valor_total.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>{lanc.servicos_nomes || 'Serviço não especificado'}</span>
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-medium">
                          {lanc.forma_pagamento || 'Não informado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-gray-500">Nenhuma entrada hoje</p>
                </div>
              )}
            </div>

            {/* Botão Fechar */}
            <div className="p-4 border-t">
              <button
                onClick={() => setModalHoje(false)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Entradas do Mês */}
      {modalMes && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setModalMes(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center text-3xl">
                    📈
                  </div>
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">Faturamento do Mês</h2>
                    <p className="text-purple-100 text-sm">{new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalMes(false)}
                  className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Resumo */}
            <div className="p-4 bg-purple-50 border-b border-purple-200">
              <div className="flex justify-between items-center">
                <span className="text-purple-700 font-medium">Total do mês:</span>
                <span className="text-2xl font-bold text-purple-700">R$ {data.totalMes.toFixed(2)}</span>
              </div>
              <span className="text-sm text-purple-600">{data.lancamentosMes.length} lançamento(s)</span>
            </div>

            {/* Lista de Lançamentos */}
            <div className="p-4 max-h-96 overflow-y-auto">
              {data.lancamentosMes.length > 0 ? (
                <div className="space-y-3">
                  {data.lancamentosMes.map((lanc) => (
                    <div
                      key={lanc.id}
                      className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-bold text-gray-800">{lanc.clientes?.nome || 'Cliente não informado'}</p>
                          <p className="text-sm text-gray-600">{lanc.colaboradores?.nome}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-purple-600 text-lg block">R$ {lanc.valor_total.toFixed(2)}</span>
                          <span className="text-xs text-gray-500">{formatarDataCompleta(lanc.data)}</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-gray-500">
                        <span>{lanc.servicos_nomes || 'Serviço não especificado'}</span>
                        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-lg text-xs font-medium">
                          {lanc.forma_pagamento || 'Não informado'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-5xl mb-3">📭</div>
                  <p className="text-gray-500">Nenhum lançamento este mês</p>
                </div>
              )}
            </div>

            {/* Botão Fechar */}
            <div className="p-4 border-t">
              <button
                onClick={() => setModalMes(false)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
