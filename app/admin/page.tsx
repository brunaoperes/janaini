'use client';

import { useState, useEffect } from 'react';
export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';

interface AdminCardProps {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  gradient: string;
  stats?: { label: string; value: string | number }[];
  delay?: number;
}

function AdminCard({ href, title, description, icon, gradient, stats, delay = 0 }: AdminCardProps) {
  return (
    <Link
      href={href}
      className="group bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft hover:shadow-soft-xl transition-all duration-300 hover:-translate-y-2 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300`}>
          <div className="text-white">
            {icon}
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-purple-600 transition-colors">
            {title}
          </h2>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div className="pt-4 border-t border-purple-100">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat, index) => (
              <div key={index}>
                <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
                <p className="text-lg font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center text-purple-600 text-sm font-medium group-hover:gap-2 gap-1 transition-all">
        Acessar
        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

export default function AdminPage() {
  const { isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({});
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    loadStats();
    setGreeting(getGreeting());
  }, []);

  const getGreeting = () => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Bom dia';
    if (hora < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  const loadStats = async () => {
    setLoading(true);

    // Formatar data de hoje no padrão YYYY-MM-DD
    const hoje = new Date();
    const hojeStr = format(hoje, 'yyyy-MM-dd');

    const [
      { data: clientes },
      { data: colaboradores },
      { data: agendamentosHoje },
      { data: lancamentos },
      { data: lancamentosHoje },
    ] = await Promise.all([
      supabase.from('clientes').select('*'),
      supabase.from('colaboradores').select('*'),
      supabase.from('agendamentos').select('*').gte('data_hora', `${hojeStr}T00:00:00`).lte('data_hora', `${hojeStr}T23:59:59`),
      supabase.from('lancamentos').select('*'),
      supabase.from('lancamentos').select('*').gte('data', `${hojeStr}T00:00:00`).lte('data', `${hojeStr}T23:59:59`),
    ]);

    // Calcular comissão média
    const comissaoMedia = colaboradores && colaboradores.length > 0
      ? colaboradores.reduce((sum, c) => sum + c.porcentagem_comissao, 0) / colaboradores.length
      : 0;

    // Calcular melhor colaboradora
    const faturamentoPorColab: any = {};
    lancamentos?.forEach((l: any) => {
      faturamentoPorColab[l.colaborador_id] = (faturamentoPorColab[l.colaborador_id] || 0) + l.valor_total;
    });
    const melhorColabId = Object.entries(faturamentoPorColab).sort(([, a]: any, [, b]: any) => b - a)[0]?.[0];
    const melhorColab = colaboradores?.find((c) => c.id === Number(melhorColabId));

    // Calcular faturamento
    const faturamentoTotal = lancamentos?.reduce((sum, l) => sum + l.valor_total, 0) || 0;
    const faturamentoHoje = lancamentosHoje?.reduce((sum, l) => sum + l.valor_total, 0) || 0;

    setStats({
      totalClientes: clientes?.length || 0,
      totalColaboradores: colaboradores?.length || 0,
      comissaoMedia: comissaoMedia.toFixed(0),
      melhorColab: melhorColab?.nome || 'N/A',
      agendamentosHoje: agendamentosHoje?.length || 0,
      faturamentoHoje: faturamentoHoje.toFixed(2),
      faturamentoTotal: faturamentoTotal.toFixed(2),
    });

    setLoading(false);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FDECFB] via-[#E7D3FF] to-white">
      {/* Header Premium */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-purple-100 shadow-soft">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-2 text-purple-600 hover:text-purple-800 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-medium">Voltar</span>
              </Link>
              <div className="h-6 w-px bg-purple-200" />
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {greeting}!
                </h1>
                <p className="text-sm text-gray-600">Naví Belle - Painel Administrativo</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">{format(new Date(), "dd 'de' MMMM, yyyy")}</div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold shadow-lg">
                J
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        {/* Dashboard Principal - Destaque */}
        <div className="mb-8">
          <Link
            href="/admin/dashboard"
            className="group block bg-gradient-to-br from-purple-500 via-purple-600 to-pink-500 rounded-3xl p-8 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] animate-fade-in-up"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold">Dashboard Completo</h2>
                    <p className="text-purple-100 text-lg">Análises, gráficos e métricas do negócio</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                    <p className="text-purple-100 text-sm mb-1">Faturamento Hoje</p>
                    <p className="text-2xl font-bold">R$ {stats.faturamentoHoje}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                    <p className="text-purple-100 text-sm mb-1">Agendamentos</p>
                    <p className="text-2xl font-bold">{stats.agendamentosHoje}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                    <p className="text-purple-100 text-sm mb-1">Faturamento Total</p>
                    <p className="text-2xl font-bold">R$ {stats.faturamentoTotal}</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur rounded-xl p-4">
                    <p className="text-purple-100 text-sm mb-1">Destaque</p>
                    <p className="text-xl font-bold truncate">{stats.melhorColab}</p>
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <svg className="w-8 h-8 group-hover:translate-x-2 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Cards de Navegação */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AdminCard
            href="/admin/clientes"
            title="Clientes"
            description="Gerenciar cadastro de clientes"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            }
            gradient="from-blue-400 to-blue-600"
            stats={[
              { label: 'Total cadastrados', value: stats.totalClientes },
              { label: 'Ativos', value: stats.totalClientes },
            ]}
            delay={100}
          />

          <AdminCard
            href="/admin/colaboradores"
            title="Colaboradoras"
            description="Gerenciar equipe e comissões"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            gradient="from-purple-400 to-purple-600"
            stats={[
              { label: 'Total', value: stats.totalColaboradores },
              { label: 'Comissão média', value: `${stats.comissaoMedia}%` },
            ]}
            delay={200}
          />

          <AdminCard
            href="/admin/servicos"
            title="Serviços"
            description="Gerenciar serviços e valores"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            gradient="from-indigo-400 to-indigo-600"
            delay={250}
          />

          <AdminCard
            href="/admin/pagamentos"
            title="Formas de Pagamento"
            description="Gerenciar taxas de cartão"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            }
            gradient="from-emerald-400 to-teal-600"
            delay={260}
          />

          <AdminCard
            href="/admin/fiados"
            title="Controle de Fiados"
            description="Gerenciar pagamentos pendentes"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradient="from-orange-400 to-red-600"
            delay={265}
          />

          <AdminCard
            href="/agenda"
            title="Agenda Geral"
            description="Ver todos os agendamentos"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            }
            gradient="from-pink-400 to-pink-600"
            stats={[
              { label: 'Hoje', value: stats.agendamentosHoje },
              { label: 'Status', value: 'Ativo' },
            ]}
            delay={300}
          />

          <AdminCard
            href="/lancamentos"
            title="Lançamentos"
            description="Registrar atendimentos e pagamentos"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            gradient="from-orange-400 to-orange-600"
            stats={[
              { label: 'Hoje', value: `R$ ${stats.faturamentoHoje}` },
              { label: 'Total', value: `R$ ${stats.faturamentoTotal}` },
            ]}
            delay={350}
          />

          <AdminCard
            href="/admin/relatorios"
            title="Relatórios Financeiros"
            description="Análises e métricas detalhadas"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            }
            gradient="from-green-400 to-green-600"
            stats={[
              { label: 'Faturamento hoje', value: `R$ ${stats.faturamentoHoje}` },
              { label: 'Total', value: `R$ ${stats.faturamentoTotal}` },
            ]}
            delay={400}
          />

          <AdminCard
            href="/colaboradores"
            title="Área das Colaboradoras"
            description="Agendas e atendimentos individuais"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            }
            gradient="from-violet-400 to-violet-600"
            stats={[
              { label: 'Ativas', value: stats.totalColaboradores },
              { label: 'Melhor', value: stats.melhorColab },
            ]}
            delay={500}
          />

          {isAdmin && (
            <>
              <AdminCard
                href="/admin/usuarios"
                title="Usuários do Sistema"
                description="Gerenciar usuários e acessos"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                }
                gradient="from-red-400 to-red-600"
                delay={550}
              />

              <AdminCard
                href="/admin/permissoes"
                title="Permissões"
                description="Gerenciar grupos e permissões"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                }
                gradient="from-amber-400 to-amber-600"
                delay={560}
              />

              <AdminCard
                href="/admin/logs"
                title="Logs de Auditoria"
                description="Histórico completo de operações"
                icon={
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                }
                gradient="from-indigo-400 to-indigo-600"
                delay={570}
              />
            </>
          )}

          <AdminCard
            href="/"
            title="Voltar ao Início"
            description="Página principal do sistema"
            icon={
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            }
            gradient="from-gray-400 to-gray-600"
            delay={600}
          />
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-white/60 backdrop-blur-xl rounded-2xl p-6 border border-purple-100 shadow-soft">
          <h3 className="text-lg font-bold text-gray-800 mb-4">Ações Rápidas</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Novo Cliente</span>
            </button>
            <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-pink-50 hover:bg-pink-100 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Agendar</span>
            </button>
            <Link href="/lancamentos" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Lançamento</span>
            </Link>
            <button className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700">Relatório</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
