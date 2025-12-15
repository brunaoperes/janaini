'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import { supabase, Lancamento, Colaborador } from '@/lib/supabase';
import { format, startOfWeek, endOfWeek, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';
import StatCard from '@/components/admin/StatCard';
import ChartCard from '@/components/admin/ChartCard';
import MetricBadge from '@/components/admin/MetricBadge';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

type PeriodoType = 'dia' | 'semana' | 'mes' | 'personalizado';

export default function RelatoriosPage() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [lancamentosAnterior, setLancamentosAnterior] = useState<Lancamento[]>([]);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<PeriodoType>('mes');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataInicio, setDataInicio] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedColaborador, setSelectedColaborador] = useState<number | 'todos'>('todos');
  const [selectedPagamento, setSelectedPagamento] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'graficos' | 'tabela'>('graficos');

  useEffect(() => {
    loadColaboradores();
  }, []);

  useEffect(() => {
    if (colaboradores.length > 0) {
      loadLancamentos();
    }
  }, [periodo, selectedDate, dataInicio, dataFim, selectedColaborador, selectedPagamento, colaboradores]);

  const loadColaboradores = async () => {
    const { data } = await supabase
      .from('colaboradores')
      .select('*')
      .order('nome');

    if (data) setColaboradores(data);
  };

  const loadLancamentos = async () => {
    setLoading(true);

    let startDate, endDate, startDateAnterior, endDateAnterior;

    if (periodo === 'dia') {
      startDate = startOfDay(new Date(selectedDate));
      endDate = endOfDay(new Date(selectedDate));
      startDateAnterior = startOfDay(new Date(new Date(selectedDate).getTime() - 24 * 60 * 60 * 1000));
      endDateAnterior = endOfDay(new Date(new Date(selectedDate).getTime() - 24 * 60 * 60 * 1000));
    } else if (periodo === 'semana') {
      startDate = startOfWeek(new Date(selectedDate), { locale: ptBR });
      endDate = endOfWeek(new Date(selectedDate), { locale: ptBR });
      startDateAnterior = subWeeks(startDate, 1);
      endDateAnterior = subWeeks(endDate, 1);
    } else if (periodo === 'mes') {
      startDate = startOfMonth(new Date(selectedDate));
      endDate = endOfMonth(new Date(selectedDate));
      startDateAnterior = startOfMonth(subMonths(new Date(selectedDate), 1));
      endDateAnterior = endOfMonth(subMonths(new Date(selectedDate), 1));
    } else {
      startDate = startOfDay(new Date(dataInicio));
      endDate = endOfDay(new Date(dataFim));
      const diff = endDate.getTime() - startDate.getTime();
      startDateAnterior = new Date(startDate.getTime() - diff);
      endDateAnterior = new Date(endDate.getTime() - diff);
    }

    let query = supabase
      .from('lancamentos')
      .select(`
        *,
        colaborador:colaboradores(*),
        cliente:clientes(*)
      `)
      .gte('data', startDate.toISOString())
      .lte('data', endDate.toISOString())
      .order('data', { ascending: false });

    if (selectedColaborador !== 'todos') {
      query = query.eq('colaborador_id', selectedColaborador);
    }

    if (selectedPagamento !== 'todos') {
      query = query.eq('forma_pagamento', selectedPagamento);
    }

    const { data } = await query;

    // Carregar período anterior para comparação
    let queryAnterior = supabase
      .from('lancamentos')
      .select('*')
      .gte('data', startDateAnterior.toISOString())
      .lte('data', endDateAnterior.toISOString());

    if (selectedColaborador !== 'todos') {
      queryAnterior = queryAnterior.eq('colaborador_id', selectedColaborador);
    }

    const { data: dataAnterior } = await queryAnterior;

    if (data) setLancamentos(data);
    if (dataAnterior) setLancamentosAnterior(dataAnterior);
    setLoading(false);
  };

  const calcularEstatisticas = () => {
    const total = lancamentos.reduce((acc, l) => acc + l.valor_total, 0);
    const comissaoColaboradores = lancamentos.reduce((acc, l) => acc + l.comissao_colaborador, 0);
    const comissaoSalao = lancamentos.reduce((acc, l) => acc + l.comissao_salao, 0);
    const totalAnterior = lancamentosAnterior.reduce((acc, l) => acc + l.valor_total, 0);

    const ticketMedio = lancamentos.length > 0 ? total / lancamentos.length : 0;
    const trendTotal = totalAnterior > 0 ? ((total - totalAnterior) / totalAnterior) * 100 : 0;

    return {
      total,
      comissaoColaboradores,
      comissaoSalao,
      ticketMedio,
      totalAtendimentos: lancamentos.length,
      trendTotal,
    };
  };

  const getTotaisPorColaborador = () => {
    const totais: Record<number, { nome: string; total: number; comissao: number; atendimentos: number }> = {};

    lancamentos.forEach((l) => {
      if (!totais[l.colaborador_id]) {
        totais[l.colaborador_id] = {
          nome: l.colaborador?.nome || 'Desconhecido',
          total: 0,
          comissao: 0,
          atendimentos: 0,
        };
      }
      totais[l.colaborador_id].total += l.valor_total;
      totais[l.colaborador_id].comissao += l.comissao_colaborador;
      totais[l.colaborador_id].atendimentos += 1;
    });

    return Object.values(totais).sort((a, b) => b.total - a.total);
  };

  const getFormasPagamento = () => {
    const formas: Record<string, number> = {};

    lancamentos.forEach((l) => {
      const key = l.forma_pagamento || 'Não informado';
      formas[key] = (formas[key] || 0) + l.valor_total;
    });

    return Object.entries(formas).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  };

  const getEvolucaoTemporal = () => {
    const dados: Record<string, number> = {};

    lancamentos.forEach((l) => {
      let chave: string;
      if (periodo === 'dia') {
        chave = format(new Date(l.data), 'HH:00');
      } else if (periodo === 'semana') {
        chave = format(new Date(l.data), 'EEE', { locale: ptBR });
      } else {
        chave = format(new Date(l.data), 'dd/MM');
      }

      dados[chave] = (dados[chave] || 0) + l.valor_total;
    });

    return Object.entries(dados).map(([label, valor]) => ({ label, valor }));
  };

  const getTop3Servicos = () => {
    // Simulando dados de serviços (pode ser expandido com campo real no banco)
    return [
      { servico: 'Corte + Escova', quantidade: 45, valor: 3500 },
      { servico: 'Coloração', quantidade: 28, valor: 4200 },
      { servico: 'Hidratação', quantidade: 35, valor: 2100 },
    ];
  };

  const stats = calcularEstatisticas();
  const totaisPorColaborador = getTotaisPorColaborador();
  const formasPagamento = getFormasPagamento();
  const evolucaoTemporal = getEvolucaoTemporal();
  const top3Servicos = getTop3Servicos();

  const COLORS = ['#A86CFF', '#E339D7', '#5F8BFF', '#FF6B9D', '#48C9B0', '#FFA07A'];

  if (loading && colaboradores.length === 0) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDECFB] via-[#E7D3FF] to-white">
      {/* Header Premium */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Naví Belle - Relatórios
                </h1>
                <p className="text-sm text-gray-600">Análises e métricas completas</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('graficos')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'graficos'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Gráficos
              </button>
              <button
                onClick={() => setViewMode('tabela')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  viewMode === 'tabela'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Tabela
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Filtros Avançados */}
        <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Filtros</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Período</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value as PeriodoType)}
                className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
              >
                <option value="dia">Dia</option>
                <option value="semana">Semana</option>
                <option value="mes">Mês</option>
                <option value="personalizado">Personalizado</option>
              </select>
            </div>

            {periodo !== 'personalizado' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Data de Referência</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Início</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Data Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Colaboradora</label>
              <select
                value={selectedColaborador}
                onChange={(e) => setSelectedColaborador(e.target.value === 'todos' ? 'todos' : parseInt(e.target.value))}
                className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
              >
                <option value="todos">Todas</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forma de Pagamento</label>
              <select
                value={selectedPagamento}
                onChange={(e) => setSelectedPagamento(e.target.value)}
                className="w-full px-4 py-2 border border-purple-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white text-sm"
              >
                <option value="todos">Todas</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="credito">Crédito</option>
                <option value="debito">Débito</option>
                <option value="pix">PIX</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Faturamento Total"
            value={`R$ ${stats.total.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            subtitle={`${stats.totalAtendimentos} atendimentos`}
            trend={{
              value: Math.round(Math.abs(stats.trendTotal)),
              isPositive: stats.trendTotal >= 0,
            }}
            gradient="from-green-400 to-green-600"
            delay={0}
          />

          <StatCard
            title="Lucro do Salão"
            value={`R$ ${stats.comissaoSalao.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            subtitle="após comissões"
            gradient="from-purple-400 to-purple-600"
            delay={100}
          />

          <StatCard
            title="Comissão Colaboradoras"
            value={`R$ ${stats.comissaoColaboradores.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            subtitle="total pago"
            gradient="from-pink-400 to-pink-600"
            delay={200}
          />

          <StatCard
            title="Ticket Médio"
            value={`R$ ${stats.ticketMedio.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            }
            subtitle="por atendimento"
            gradient="from-blue-400 to-blue-600"
            delay={300}
          />
        </div>

        {viewMode === 'graficos' ? (
          <>
            {/* Gráficos Principais */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* Evolução Temporal */}
              <ChartCard title="Evolução do Faturamento" subtitle={`Período: ${periodo}`}>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={evolucaoTemporal}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#A86CFF" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#A86CFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E7D3FF" />
                    <XAxis dataKey="label" stroke="#9333EA" />
                    <YAxis stroke="#9333EA" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid #E7D3FF',
                        borderRadius: '12px',
                      }}
                    />
                    <Area type="monotone" dataKey="valor" stroke="#A86CFF" fillOpacity={1} fill="url(#colorValor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Formas de Pagamento */}
              <ChartCard title="Formas de Pagamento" subtitle="Distribuição por valor">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={formasPagamento}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {formasPagamento.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Atendimentos por Colaboradora */}
            <ChartCard title="Desempenho por Colaboradora" subtitle="Faturamento total">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={totaisPorColaborador}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7D3FF" />
                  <XAxis dataKey="nome" stroke="#9333EA" />
                  <YAxis stroke="#9333EA" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      border: '1px solid #E7D3FF',
                      borderRadius: '12px',
                    }}
                  />
                  <Bar dataKey="total" fill="#A86CFF" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="comissao" fill="#E339D7" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Top 3 Serviços */}
            <div className="mt-8 bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Top 3 Serviços Mais Realizados</h3>
              <div className="space-y-4">
                {top3Servicos.map((servico, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${COLORS[index % COLORS.length]} flex items-center justify-center text-white font-bold`}>
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{servico.servico}</p>
                        <p className="text-sm text-gray-600">{servico.quantidade} vezes</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">R$ {servico.valor.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Totais por Colaborador */}
            {selectedColaborador === 'todos' && totaisPorColaborador.length > 0 && (
              <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft mb-8">
                <h2 className="text-xl font-bold text-gray-800 mb-4">Resumo por Colaboradora</h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-purple-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Colaboradora</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Atendimentos</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {totaisPorColaborador.map((t, idx) => (
                        <tr key={idx} className="border-b border-purple-100 hover:bg-purple-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-800">{t.nome}</td>
                          <td className="px-4 py-3 text-right text-gray-600">{t.atendimentos}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">R$ {t.total.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-600">
                            R$ {t.comissao.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Lista de Lançamentos */}
            <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">
                  Lançamentos ({lancamentos.length})
                </h2>
                <div className="flex items-center gap-2">
                  <MetricBadge label="Total" value={`R$ ${stats.total.toFixed(2)}`} color="purple" />
                </div>
              </div>

              {loading ? (
                <LoadingSpinner />
              ) : lancamentos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">Nenhum lançamento encontrado para este período</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-purple-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Data/Hora</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Cliente</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Colaboradora</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Valor</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Pagamento</th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Comissão</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lancamentos.map((lancamento) => (
                        <tr key={lancamento.id} className="border-b border-purple-100 hover:bg-purple-50 transition-colors">
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {format(new Date(lancamento.data), 'dd/MM/yy HH:mm')}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-gray-800">{lancamento.cliente?.nome || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{lancamento.colaborador?.nome}</td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800">
                            R$ {lancamento.valor_total.toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 capitalize">
                              {lancamento.forma_pagamento}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-purple-600">
                            R$ {lancamento.comissao_colaborador.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
