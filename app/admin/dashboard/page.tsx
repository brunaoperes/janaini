'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';
import StatCard from '@/components/admin/StatCard';
import ChartCard from '@/components/admin/ChartCard';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [chartData, setChartData] = useState<any>({});

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);

    const hoje = new Date();
    const inicioHoje = startOfDay(hoje);
    const fimHoje = endOfDay(hoje);
    const inicioMes = startOfMonth(hoje);
    const fimMes = endOfMonth(hoje);
    const inicioMesAnterior = startOfMonth(subMonths(hoje, 1));
    const fimMesAnterior = endOfMonth(subMonths(hoje, 1));

    // Carregar dados
    const [
      { data: clientes },
      { data: colaboradores },
      { data: agendamentosHoje },
      { data: agendamentosMes },
      { data: lancamentosHoje },
      { data: lancamentosMes },
      { data: lancamentosMesAnterior },
    ] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('colaboradores').select('*'),
      supabase.from('agendamentos').select('*').gte('data_hora', inicioHoje.toISOString()).lte('data_hora', fimHoje.toISOString()),
      supabase.from('agendamentos').select('*').gte('data_hora', inicioMes.toISOString()).lte('data_hora', fimMes.toISOString()),
      supabase.from('lancamentos').select('*, colaborador:colaboradores(nome), cliente:clientes(nome)').gte('data', inicioHoje.toISOString()).lte('data', fimHoje.toISOString()),
      supabase.from('lancamentos').select('*, colaborador:colaboradores(nome)').gte('data', inicioMes.toISOString()).lte('data', fimMes.toISOString()),
      supabase.from('lancamentos').select('*').gte('data', inicioMesAnterior.toISOString()).lte('data', fimMesAnterior.toISOString()),
    ]);

    // Calcular estatísticas
    const faturamentoHoje = lancamentosHoje?.reduce((sum, l) => sum + l.valor_total, 0) || 0;
    const faturamentoMes = lancamentosMes?.reduce((sum, l) => sum + l.valor_total, 0) || 0;
    const faturamentoMesAnterior = lancamentosMesAnterior?.reduce((sum, l) => sum + l.valor_total, 0) || 0;
    const comissaoTotalMes = lancamentosMes?.reduce((sum, l) => sum + l.comissao_colaborador, 0) || 0;
    const lucroMes = faturamentoMes - comissaoTotalMes;

    const trendMes = faturamentoMesAnterior > 0
      ? ((faturamentoMes - faturamentoMesAnterior) / faturamentoMesAnterior) * 100
      : 0;

    const ticketMedio = lancamentosMes && lancamentosMes.length > 0
      ? faturamentoMes / lancamentosMes.length
      : 0;

    // Preparar dados para gráficos
    // 1. Evolução diária do mês
    const diasDoMes: any = {};
    for (let i = 1; i <= hoje.getDate(); i++) {
      diasDoMes[i] = 0;
    }
    lancamentosMes?.forEach((l) => {
      const dia = new Date(l.data).getDate();
      diasDoMes[dia] = (diasDoMes[dia] || 0) + l.valor_total;
    });
    const evolucaoDiaria = Object.keys(diasDoMes).map((dia) => ({
      dia: `${dia}`,
      valor: diasDoMes[dia],
    }));

    // 2. Formas de pagamento
    const formasPagamento: any = {};
    lancamentosMes?.forEach((l) => {
      formasPagamento[l.forma_pagamento] = (formasPagamento[l.forma_pagamento] || 0) + l.valor_total;
    });
    const formasPagamentoChart = Object.keys(formasPagamento).map((forma) => ({
      name: forma.charAt(0).toUpperCase() + forma.slice(1),
      value: formasPagamento[forma],
    }));

    // 3. Atendimentos por colaboradora
    const atendimentosPorColab: any = {};
    lancamentosMes?.forEach((l: any) => {
      const nome = l.colaborador?.nome || 'Sem colaborador';
      atendimentosPorColab[nome] = (atendimentosPorColab[nome] || 0) + 1;
    });
    const atendimentosChart = Object.keys(atendimentosPorColab).map((nome) => ({
      nome,
      atendimentos: atendimentosPorColab[nome],
    }));

    // 4. Top colaboradora
    const faturamentoPorColab: any = {};
    lancamentosMes?.forEach((l: any) => {
      const nome = l.colaborador?.nome || 'Sem colaborador';
      faturamentoPorColab[nome] = (faturamentoPorColab[nome] || 0) + l.valor_total;
    });
    const topColaboradora = Object.entries(faturamentoPorColab).sort(([, a]: any, [, b]: any) => b - a)[0];

    setStats({
      totalClientes: clientes?.length || 0,
      totalColaboradores: colaboradores?.length || 0,
      agendamentosHoje: agendamentosHoje?.length || 0,
      agendamentosMes: agendamentosMes?.length || 0,
      faturamentoHoje,
      faturamentoMes,
      comissaoTotalMes,
      lucroMes,
      ticketMedio,
      trendMes,
      topColaboradora: topColaboradora ? { nome: topColaboradora[0], valor: topColaboradora[1] } : null,
    });

    setChartData({
      evolucaoDiaria,
      formasPagamento: formasPagamentoChart,
      atendimentos: atendimentosChart,
    });

    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  const COLORS = ['#A86CFF', '#E339D7', '#5F8BFF', '#FF6B9D'];

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
                  Naví Belle - Dashboard
                </h1>
                <p className="text-sm text-gray-600">Visão geral do negócio</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">{format(new Date(), "dd 'de' MMMM, yyyy")}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* KPIs Principais */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Faturamento Hoje"
            value={`R$ ${stats.faturamentoHoje.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            subtitle={`${stats.agendamentosHoje} agendamentos`}
            gradient="from-green-400 to-green-600"
            delay={0}
          />

          <StatCard
            title="Faturamento do Mês"
            value={`R$ ${stats.faturamentoMes.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            subtitle={`${stats.agendamentosMes} atendimentos`}
            trend={{
              value: Math.round(stats.trendMes),
              isPositive: stats.trendMes >= 0,
            }}
            gradient="from-purple-400 to-purple-600"
            delay={100}
          />

          <StatCard
            title="Lucro do Salão"
            value={`R$ ${stats.lucroMes.toFixed(2)}`}
            icon={
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            }
            subtitle={`Comissões: R$ ${stats.comissaoTotalMes.toFixed(2)}`}
            gradient="from-blue-400 to-blue-600"
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
            gradient="from-pink-400 to-pink-600"
            delay={300}
          />
        </div>

        {/* Destaques e Métricas Secundárias */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total de Clientes</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalClientes}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-purple-100">
              <p className="text-xs text-gray-500">Cadastrados no sistema</p>
            </div>
          </div>

          <div className="bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-600">Colaboradoras</p>
                <p className="text-2xl font-bold text-gray-800">{stats.totalColaboradores}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-purple-100">
              <p className="text-xs text-gray-500">Ativas no salão</p>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </div>
              <div>
                <p className="text-sm opacity-90">Destaque do Mês</p>
                <p className="text-xl font-bold">{stats.topColaboradora?.nome || 'N/A'}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-white/20">
              <p className="text-sm">Faturou R$ {stats.topColaboradora?.valor.toFixed(2) || '0.00'}</p>
            </div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Evolução Diária */}
          <ChartCard title="Evolução Diária do Faturamento" subtitle="Últimos dias do mês">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData.evolucaoDiaria}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E7D3FF" />
                <XAxis dataKey="dia" stroke="#9333EA" />
                <YAxis stroke="#9333EA" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #E7D3FF',
                    borderRadius: '12px',
                  }}
                />
                <Line type="monotone" dataKey="valor" stroke="#A86CFF" strokeWidth={3} dot={{ fill: '#A86CFF', r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Formas de Pagamento */}
          <ChartCard title="Formas de Pagamento" subtitle="Distribuição no mês">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData.formasPagamento}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.formasPagamento?.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Atendimentos por Colaboradora */}
        <ChartCard title="Atendimentos por Colaboradora" subtitle="Produtividade do mês">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.atendimentos}>
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
              <Bar dataKey="atendimentos" fill="#A86CFF" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
